import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { api, useCurrentUser } from 'five-api-client';
import { Alert, Card, formatDateTime, Loading, PageTitle, StatusBadge } from 'five-ui';
import Screen from '../../components/Screen';
import { LinkButton, LinkCard } from '../../components/links';

export default function Dashboard() {
  const [groups, setGroups] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = useCurrentUser();

  /**
   * Rechargement a chaque retour sur l'ecran, et non au seul montage.
   *
   * Expo Router garde les ecrans montes dans la pile : revenir ici apres
   * avoir supprime une session ou quitte un groupe n'aurait rien rejoue, et
   * la liste aurait continue d'afficher ce qui n'existe plus.
   */
  useFocusEffect(
    useCallback(() => {
      let alive = true;

      const load = async () => {
        try {
          const [groupsRes, eventsRes] = await Promise.all([
            api.get('/groups'),
            api.get('/events'),
          ]);
          if (!alive) return;
          setGroups(groupsRes.data);
          setEvents(eventsRes.data);
          setError(null);
        } catch (err: any) {
          if (alive) setError(err.response?.data?.message ?? 'Chargement impossible');
        } finally {
          if (alive) setLoading(false);
        }
      };

      load();
      return () => {
        alive = false;
      };
    }, [])
  );

  if (loading) return <Loading />;

  return (
    <Screen>
      <PageTitle subtitle="Vos groupes et vos prochaines sessions.">
        Bonjour {user?.firstName ?? ''}
      </PageTitle>

      {error ? (
        <View className="mb-4">
          <Alert kind="error">{error}</Alert>
        </View>
      ) : null}

      <View className="flex-col sm:flex-row gap-3 mb-8">
        <LinkButton href="/sessions/nouvelle" className="sm:flex-1">
          Créer une session
        </LinkButton>
        <LinkButton href="/groupes/nouveau" variant="secondary" className="sm:flex-1">
          Créer un groupe
        </LinkButton>
      </View>

      <View className="mb-8">
        <Text className="text-xl font-bold text-gray-900 mb-3">Prochaines sessions</Text>

        {events.length === 0 ? (
          <Card>
            <Text className="text-gray-600">
              Aucune session à venir.{' '}
              <Link href="/sessions/nouvelle" className="text-green-700 underline font-medium">
                Créez la première
              </Link>
              .
            </Text>
          </Card>
        ) : (
          <View className="gap-3">
            {events.map((event) => (
              <LinkCard key={event.id} href={`/sessions/${event.id}`}>
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text numberOfLines={1} className="font-semibold text-gray-900">
                      {event.title}
                    </Text>
                    <Text className="text-sm text-gray-600 mt-1">
                      {formatDateTime(event.dateTime)}
                    </Text>
                    {event.location ? (
                      <Text numberOfLines={1} className="text-sm text-gray-500 mt-0.5">
                        {event.location}
                      </Text>
                    ) : null}
                  </View>
                  <StatusBadge status={event.status} />
                </View>
              </LinkCard>
            ))}
          </View>
        )}
      </View>

      <View>
        <Text className="text-xl font-bold text-gray-900 mb-3">Mes groupes</Text>

        {groups.length === 0 ? (
          <Card>
            <Text className="text-gray-600">
              Vous n'êtes dans aucun groupe.{' '}
              <Link href="/groupes/nouveau" className="text-green-700 underline font-medium">
                Créez le vôtre
              </Link>
              .
            </Text>
          </Card>
        ) : (
          <View className="gap-3">
            {groups.map((group) => (
              <LinkCard key={group.id} href={`/groupes/${group.id}`}>
                <View className="flex-row items-center justify-between gap-3">
                  <View className="flex-1">
                    <Text numberOfLines={1} className="font-semibold text-gray-900">
                      {group.name}
                    </Text>
                    {group.city ? (
                      <Text className="text-sm text-gray-600">{group.city}</Text>
                    ) : null}
                  </View>
                  {!group.isMember ? (
                    <Text className="text-xs text-gray-500">Public</Text>
                  ) : null}
                </View>
              </LinkCard>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}
