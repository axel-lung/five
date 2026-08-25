import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api, useHasSession } from 'five-api-client';
import { Alert, Button, Card, Loading, PageTitle } from 'five-ui';
import Screen from '../../../components/Screen';

/**
 * Parcours critique « rejoindre un groupe » (G-02, G-04).
 *
 * L'apercu est volontairement consultable sans compte : le lien circule sur
 * WhatsApp, et demander de creer un compte avant meme de savoir de quel
 * groupe il s'agit ferait perdre la moitie des invites. La creation de compte
 * n'intervient qu'au moment d'accepter, et l'on revient ici ensuite.
 */
export default function JoinGroup() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { checking, authenticated } = useHasSession();

  useEffect(() => {
    api
      .get(`/groups/invitations/${token}`)
      .then((res) => setPreview(res.data))
      .catch((err) =>
        setError(err.response?.data?.message ?? "Cette invitation n'est plus valable")
      )
      .finally(() => setLoading(false));
  }, [token]);

  const accept = async () => {
    if (!authenticated) {
      // On memorise l'invitation : apres connexion, le joueur retombe ici.
      router.push(`/login?redirect=${encodeURIComponent(`/invitation/${token}`)}` as never);
      return;
    }

    setJoining(true);
    setError(null);

    try {
      const response = await api.post(`/groups/invitations/${token}/accept`);
      router.replace(`/groupes/${response.data.groupId}` as never);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Impossible de rejoindre ce groupe');
      setJoining(false);
    }
  };

  if (loading || checking) return <Loading />;
  if (error && !preview) return <Alert kind="error">{error}</Alert>;

  return (
    <Screen className="max-w-md self-center">
      <PageTitle subtitle="Vous êtes invité à rejoindre ce groupe.">Invitation</PageTitle>

      <Card className="mb-4">
        <Text className="text-xl font-bold text-gray-900">{preview.group.name}</Text>
        {preview.group.city ? (
          <Text className="text-gray-600">{preview.group.city}</Text>
        ) : null}
        {preview.group.description ? (
          <Text className="text-sm text-gray-700 mt-3">{preview.group.description}</Text>
        ) : null}
        <Text className="text-sm text-gray-500 mt-3">
          {preview.memberCount} membre{preview.memberCount > 1 ? 's' : ''}
        </Text>
      </Card>

      {error ? (
        <View className="mb-4">
          <Alert kind="error">{error}</Alert>
        </View>
      ) : null}

      <Button testID="invitation-accept" onPress={accept} disabled={joining} full>
        {joining ? '…' : authenticated ? 'Rejoindre le groupe' : 'Se connecter pour rejoindre'}
      </Button>
    </Screen>
  );
}
