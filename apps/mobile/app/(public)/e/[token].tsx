import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api, useHasSession } from 'five-api-client';
import { Alert, Card, formatDateTime, Loading, PageTitle, StatusBadge } from 'five-ui';
import Screen from '../../../components/Screen';
import { LinkButton } from '../../../components/links';

/**
 * E-07 : resume public d'une session, puis conversion a l'inscription.
 *
 * Aucune donnee personnelle des participants n'est exposee ici — l'API n'en
 * renvoie pas. Le joueur voit de quoi decider, et cree un compte s'il vient.
 */
const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <View className="flex-row gap-2">
    <Text className="text-sm text-gray-500 w-20">{label}</Text>
    <Text className="flex-1 text-sm font-medium text-gray-900">{children}</Text>
  </View>
);

export default function SharedEvent() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { checking, authenticated } = useHasSession();

  useEffect(() => {
    api
      .get(`/events/shared/${token}`)
      .then((res) => setEvent(res.data))
      .catch((err) => setError(err.response?.data?.message ?? 'Session introuvable'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading || checking) return <Loading />;
  if (error) return <Alert kind="error">{error}</Alert>;

  const target = `/sessions/${event.id}`;

  return (
    <Screen className="max-w-md self-center">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <PageTitle
            subtitle={event.organizer ? `Organisé par ${event.organizer.firstName}` : undefined}
          >
            {event.title}
          </PageTitle>
        </View>
        <StatusBadge status={event.status} />
      </View>

      <Card className="mb-4">
        <View className="gap-2">
          <Row label="Quand">{formatDateTime(event.dateTime)}</Row>

          {event.location ? <Row label="Où">{event.location}</Row> : null}

          <Row label="Places">
            {event.confirmedCount} / {event.capacity}
            {event.spotsLeft > 0 ? (
              <Text className="text-gray-500 font-normal">
                {' '}
                — {event.spotsLeft} restante{event.spotsLeft > 1 ? 's' : ''}
              </Text>
            ) : (
              <Text className="text-orange-700 font-normal"> — liste d'attente</Text>
            )}
          </Row>

          {event.price != null ? <Row label="Prix">{event.price} €</Row> : null}
        </View>

        {event.description ? (
          <Text className="text-sm text-gray-700 mt-4 pt-4 border-t border-gray-100">
            {event.description}
          </Text>
        ) : null}
      </Card>

      {authenticated ? (
        <LinkButton href={target}>Voir la session et m'inscrire</LinkButton>
      ) : (
        <View className="gap-3">
          <LinkButton href={`/register?redirect=${encodeURIComponent(target)}`}>
            Créer un compte pour participer
          </LinkButton>
          <LinkButton
            href={`/login?redirect=${encodeURIComponent(target)}`}
            variant="secondary"
          >
            J'ai déjà un compte
          </LinkButton>
        </View>
      )}
    </Screen>
  );
}
