import React, { useEffect, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { Link, Redirect, Tabs, usePathname } from 'expo-router';
import { api, createChatSocket, useHasSession, useProfile } from 'five-api-client';
import { eventBus, Loading } from 'five-ui';
import BugReportButton from '../../components/BugReportButton';
import BottomNav from '../../components/BottomNav';
import { shellMainClass } from '../../components/navShell';
import { SHELL_BACKGROUND } from '../../components/theme';

/**
 * Mise en page des ecrans authentifies, et garde de session.
 *
 * La navigation n'est rendue qu'une fois : une seconde copie masquee par
 * media query resterait dans l'arbre, avec ses libelles et son badge en
 * double pour les lecteurs d'ecran.
 *
 * Le compteur de non-lues vient de `GET /api/notifications`, qui renvoie deja
 * `unreadCount` : pas d'appel dedie. Il est rafraichi via l'evenement
 * `notifications:refresh`, emis par l'ecran notifications quand on marque
 * quelque chose comme lu — sans quoi le badge resterait fige.
 */
export default function ProtectedLayout() {
  const { checking, authenticated } = useHasSession();
  const { profile } = useProfile();
  const [unread, setUnread] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    if (!authenticated) return undefined;

    const refresh = () => {
      api
        .get('/notifications', { params: { unread: 'true' } })
        .then((res) => setUnread(res.data.unreadCount ?? 0))
        .catch(() => setUnread(0));
    };

    refresh();
    eventBus.on('notifications:refresh', refresh);
    return () => eventBus.off('notifications:refresh', refresh);
  }, [authenticated]);

  /**
   * S-01 : une seule socket de chat pour toute l'application, tenue ici.
   *
   * Une socket par ecran rouvrirait une connexion a chaque navigation, et
   * surtout ne pousserait rien quand aucun chat n'est ouvert — or c'est
   * justement quand la pastille doit bouger. Les trames sont rediffusees par
   * l'eventBus, deja en place pour le badge des notifications.
   */
  useEffect(() => {
    if (!authenticated) return undefined;

    const refreshChatUnread = () => {
      api
        .get('/groups/unread')
        .then((res) => setChatUnread(res.data.total ?? 0))
        .catch(() => setChatUnread(0));
    };

    refreshChatUnread();
    eventBus.on('chat:unread', refreshChatUnread);

    const socket = createChatSocket({
      onFrame: (frame) => {
        if (frame.type === 'ready') {
          eventBus.emit('chat:ready');
          refreshChatUnread();
          return;
        }

        if (frame.type === 'message') {
          eventBus.emit('chat:message', {
            groupId: frame.message.groupId,
            message: frame.message,
          });
          // Incremente localement plutot que de rappeler l'API : un groupe
          // bavard ferait sinon un aller-retour HTTP par message. L'ecran de
          // chat ouvert corrige le compteur en marquant comme lu.
          setChatUnread((count) => count + 1);
          return;
        }

        if (frame.type === 'message.deleted') {
          eventBus.emit('chat:deleted', {
            groupId: frame.message.groupId,
            message: frame.message,
          });
        }
      },
    });

    // Retour au premier plan : reconnexion immediate, sans attendre le palier
    // de backoff. En arriere-plan la socket est mise en veille — iOS la
    // couperait de toute facon, autant le faire proprement.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') socket.reconnectNow();
      else socket.suspend();
    });

    return () => {
      subscription.remove();
      eventBus.off('chat:unread', refreshChatUnread);
      socket.close();
    };
  }, [authenticated]);

  // Le coffre natif est asynchrone : tant qu'il n'a pas repondu, rediriger
  // ejecterait un joueur pourtant connecte.
  if (checking) return <Loading />;

  if (!authenticated) {
    // `location.state` du web n'a pas d'equivalent : la destination voyage
    // dans l'URL, ce qui la rend aussi partageable en lien profond.
    return <Redirect href={`/login?redirect=${encodeURIComponent(pathname)}`} />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-gray-900">
        <View className="w-full max-w-4xl self-center px-4 h-14 flex-row items-center">
          <Link href="/dashboard" asChild>
            <Text className="text-lg font-bold text-white">HighFive</Text>
          </Link>
        </View>
      </View>

      <View className={`flex-1 w-full max-w-4xl self-center px-4 py-6 ${shellMainClass}`}>
        {/* Onglets et non pile : une pile demonte les ecrans qu'on depile, si
            bien que revenir sur un onglet le rechargeait entierement. Chaque
            onglet garde ici son etat et sa propre pile interne. La barre est
            rendue par la coque, en dehors du navigateur, d'ou tabBar nul. */}
        <Tabs
          tabBar={() => null}
          // Le retour Android suit l'ordre de visite plutot que de retomber
          // systematiquement sur le premier onglet.
          backBehavior="history"
          screenOptions={{
            headerShown: false,
            sceneStyle: { backgroundColor: SHELL_BACKGROUND },
          }}
        />
        {/* Bug report button - floating action button */}
        <BugReportButton />
      </View>

      <BottomNav unread={unread} chatUnread={chatUnread} isAdmin={profile?.role === 'admin'} />
    </View>
  );
}
