import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api, mediaSrc } from 'five-api-client';
import { Alert, Avatar, Card, Loading, PageTitle } from 'five-ui';
import Screen from '../../../components/Screen';

/**
 * D-02 : profil public minimal d'un autre joueur.
 *
 * L'API ne renvoie que ce qui est partageable, et repond 404 quand un
 * blocage existe dans un sens ou dans l'autre. L'ecran n'a donc rien a
 * filtrer lui-meme.
 */
export default function PlayerProfile() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get(`/users/${userId}`)
      .then((res) => setPlayer(res.data))
      .catch((err) => setError(err.response?.data?.message ?? 'Joueur introuvable'))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <Loading />;
  if (error && !player) return <Alert kind="error">{error}</Alert>;

  const name = [player.firstName, player.lastName].filter(Boolean).join(' ') || 'Joueur';

  return (
    <Screen className="max-w-md self-center">
      <PageTitle subtitle={player.city ?? undefined}>{name}</PageTitle>

      <Card className="mb-4">
        <View className="flex-row items-center gap-4">
          <Avatar uri={mediaSrc(player.avatarUrl)} size={80} />

          <View className="gap-1">
            {player.preferredPosition ? (
              <View className="flex-row gap-2">
                <Text className="text-sm text-gray-500">Poste</Text>
                <Text className="text-sm font-medium text-gray-900">
                  {player.preferredPosition}
                </Text>
              </View>
            ) : null}

            {player.selfDeclaredLevel ? (
              <View className="flex-row gap-2">
                <Text className="text-sm text-gray-500">Niveau</Text>
                <Text className="text-sm font-medium text-gray-900">
                  {player.selfDeclaredLevel} / 5
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Card>

      {/* TODO Phase 2 : blocage (D-06) et signalement (S-05), tous deux
          derriere une demande de confirmation ou une boite de dialogue. */}
    </Screen>
  );
}
