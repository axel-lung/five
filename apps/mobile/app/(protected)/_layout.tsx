import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Link, Redirect, Stack, usePathname } from 'expo-router';
import { api, useHasSession, useProfile } from 'five-api-client';
import { eventBus, Loading } from 'five-ui';
import BottomNav from '../../components/BottomNav';
import { shellMainClass } from '../../components/navShell';

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
            <Text className="text-lg font-bold text-white">Five</Text>
          </Link>
        </View>
      </View>

      <View className={`flex-1 w-full max-w-4xl self-center px-4 py-6 ${shellMainClass}`}>
        <Stack
          screenOptions={{
            headerShown: false,
            // Sinon le fond blanc du navigateur recouvre le gris de la coque.
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
      </View>

      <BottomNav unread={unread} isAdmin={profile?.role === 'admin'} />

      {/* TODO Phase 2 : BugReportButton, joignable depuis n'importe quel ecran. */}
    </View>
  );
}
