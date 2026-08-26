import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, mediaSrc, useCurrentUser } from 'five-api-client';
import { Alert, Avatar, Button, Card, Loading, PageTitle, confirmAsync } from 'five-ui';
import Screen from '../../../components/Screen';
import ReportDialog from '../../../components/ReportDialog';

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
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const me = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    api
      .get(`/users/${userId}`)
      .then((res) => setPlayer(res.data))
      .catch((err) => setError(err.response?.data?.message ?? 'Joueur introuvable'))
      .finally(() => setLoading(false));
  }, [userId]);

  /**
   * D-06 : bloquer un joueur.
   *
   * L'API rend ensuite les deux profils mutuellement invisibles : recharger
   * cet ecran donnerait un 404. On affiche donc une confirmation et on
   * propose de revenir, plutot que de laisser le joueur sur une page qui
   * n'existe plus pour lui.
   */
  const block = async () => {
    const ok = await confirmAsync(
      "Bloquer ce joueur ? Vous ne pourrez plus vous inviter ni rejoindre les sessions de l'autre.",
      { title: 'Bloquer', confirmLabel: 'Bloquer', destructive: true }
    );
    if (!ok) return;

    setBusy(true);
    setError(null);
    try {
      await api.post(`/users/${userId}/block`);
      setBlocked(true);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Blocage impossible');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading />;
  if (error && !player) return <Alert kind="error">{error}</Alert>;

  if (blocked) {
    return (
      <Screen className="max-w-md self-center">
        <Alert kind="success">Joueur bloqué.</Alert>
        <View className="mt-4">
          <Button variant="secondary" onPress={() => router.back()} testID="block-done" full>
            Retour
          </Button>
        </View>
      </Screen>
    );
  }

  const name = [player.firstName, player.lastName].filter(Boolean).join(' ') || 'Joueur';
  const isMe = userId === me?.id;

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

      {error ? (
        <View className="mb-4">
          <Alert kind="error">{error}</Alert>
        </View>
      ) : null}

      {/* D-06 / S-05 : on ne se bloque ni ne se signale soi-meme. */}
      {!isMe ? (
        <View className="gap-3">
          <Button variant="secondary" onPress={block} disabled={busy} testID="player-block" full>
            Bloquer ce joueur
          </Button>
          <ReportDialog targetType="user" targetId={userId} label="Signaler ce joueur" />
        </View>
      ) : null}
    </Screen>
  );
}
