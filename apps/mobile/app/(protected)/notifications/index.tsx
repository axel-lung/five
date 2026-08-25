import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { api } from 'five-api-client';
import { Alert, Button, Card, eventBus, Loading, PageTitle } from 'five-ui';
import Screen from '../../../components/Screen';
import { LinkButton } from '../../../components/links';

/**
 * N-05 : centre de notifications.
 *
 * Chaque type est traduit ici plutot que cote serveur : le libelle est de
 * l'affichage, et le faire voyager dans le payload obligerait a migrer la
 * base pour corriger une faute de frappe.
 */
const LABELS: Record<string, (payload: any) => string> = {
  'event.opened': (p) => `${p.title} est ouverte aux inscriptions`,
  'event.updated': (p) => `${p.title} a changé d'horaire ou de lieu`,
  'event.cancelled': (p) => `${p.title} a été annulée`,
  'event.spot_released': (p) => `Une place s'est libérée pour ${p.title} — vous êtes confirmé`,
  'event.reminder': (p) => `${p.title} : l'organisateur attend votre réponse`,
  'event.ownership_transferred': (p) => `Vous organisez désormais ${p.title}`,
};

const describe = (notification: any) => {
  const build = LABELS[notification.type];
  return build ? build(notification.payload ?? {}) : notification.type;
};

const relative = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
};

export default function Notifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await api.get('/notifications', {
        params: onlyUnread ? { unread: 'true' } : undefined,
      });
      setNotifications(response.data.notifications);
      setUnread(response.data.unreadCount);
      // Rafraichit le badge de la navigation, qui vit hors de cet ecran.
      eventBus.emit('notifications:refresh');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [onlyUnread]);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id: string) => {
    await api.patch(`/notifications/${id}/read`).catch(() => undefined);
    await load();
  };

  const markAllRead = async () => {
    await api.post('/notifications/read-all').catch(() => undefined);
    await load();
  };

  const openNotification = async (notification: any) => {
    await markRead(notification.id);
    if (notification.payload?.eventId) {
      router.push(`/sessions/${notification.payload.eventId}` as never);
    }
  };

  if (loading) return <Loading />;

  return (
    <Screen>
      <PageTitle
        subtitle={unread > 0 ? `${unread} non lue${unread > 1 ? 's' : ''}` : 'Tout est lu.'}
      >
        Notifications
      </PageTitle>

      {error ? (
        <View className="mb-4">
          <Alert kind="error">{error}</Alert>
        </View>
      ) : null}

      <View className="flex-row flex-wrap gap-2 mb-4">
        <Button variant="secondary" onPress={() => setOnlyUnread((v) => !v)}>
          {onlyUnread ? 'Voir tout' : 'Non lues seulement'}
        </Button>

        {unread > 0 ? (
          <Button variant="secondary" onPress={markAllRead}>
            Tout marquer comme lu
          </Button>
        ) : null}

        <LinkButton href="/notifications/preferences" variant="secondary">
          Préférences
        </LinkButton>
      </View>

      {notifications.length === 0 ? (
        <Card>
          <Text className="text-gray-600">
            {onlyUnread ? 'Aucune notification non lue.' : 'Aucune notification.'}
          </Text>
        </Card>
      ) : (
        <View className="gap-2">
          {notifications.map((notification) => (
            <Pressable
              key={notification.id}
              accessibilityRole="button"
              onPress={() => openNotification(notification)}
            >
              <Card
                className={
                  notification.readAt ? 'opacity-70' : 'border-green-300 bg-green-50'
                }
              >
                <View className="flex-row items-start gap-3">
                  {!notification.readAt ? (
                    <View
                      accessibilityLabel="Non lue"
                      className="mt-1.5 w-2 h-2 rounded-full bg-green-600"
                    />
                  ) : null}
                  <View className="flex-1">
                    <Text className="text-sm text-gray-900">{describe(notification)}</Text>
                    <Text className="text-xs text-gray-500 mt-1">
                      {relative(notification.createdAt)}
                    </Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}
