import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api, mediaSrc } from 'five-api-client';
import { Alert, Avatar, Button, Card, Loading, PageTitle } from 'five-ui';
import Screen from '../../../components/Screen';

/** D-06 : les joueurs que j'ai bloques. Jamais ceux qui m'ont bloque. */
export default function Blocks() {
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await api.get('/users/me/blocks');
      setBlocks(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unblock = async (userId: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/users/${userId}/block`);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Déblocage impossible');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <Screen className="max-w-md self-center">
      <PageTitle subtitle="Ces joueurs ne peuvent ni vous inviter, ni rejoindre vos sessions.">
        Joueurs bloqués
      </PageTitle>

      {error ? (
        <View className="mb-4">
          <Alert kind="error">{error}</Alert>
        </View>
      ) : null}

      {blocks.length === 0 ? (
        <Card>
          <Text className="text-gray-600">Vous n'avez bloqué personne.</Text>
        </Card>
      ) : (
        <View className="gap-3">
          {blocks.map((block) => {
            const name =
              [block.user?.firstName, block.user?.lastName].filter(Boolean).join(' ') || 'Joueur';

            return (
              <Card key={block.user.id}>
                <View className="flex-row items-center justify-between gap-3">
                  <View className="flex-row items-center gap-3 flex-1">
                    <Avatar uri={mediaSrc(block.user?.avatarUrl)} size={40} />
                    <Text numberOfLines={1} className="flex-1 text-sm font-medium text-gray-900">
                      {name}
                    </Text>
                  </View>

                  <Button variant="secondary" disabled={busy} onPress={() => unblock(block.user.id)}>
                    Débloquer
                  </Button>
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
