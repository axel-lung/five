import React, { useState } from 'react';
import { Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import { api, clearSession, useCurrentUser } from 'five-api-client';
import { Alert, Button, Card, Field, Input, PageTitle } from 'five-ui';
import Screen from '../../../components/Screen';

/** Saisie exigée pour confirmer l'effacement : un clic seul est trop facile. */
const CONFIRMATION = 'SUPPRIMER';

export default function ProfileData() {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const user = useCurrentUser();

  const exportData = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const response = await api.get('/users/me/export');

      // Convertir la réponse en chaîne JSON avec indentation
      const jsonString = JSON.stringify(response.data, null, 2);
      const fileName = `five-mes-donnees-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      let fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      // Écrire le fichier dans le cache
      await FileSystem.writeAsStringAsync(fileUri, jsonString, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Partager le fichier
      try {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Mes données Five',
          // Sur Android, on peut aussi utiliser l'option 'utilities' pour voir les apps de partage
          // Mais on laisse le choix par défaut
        });
        setNotice('Export partagé.');
      } catch (shareError) {
        // Si le partage échoue, on informe l'utilisateur que le fichier est sauvegardé en cache
        console.warn('Share failed:', shareError);
        setNotice(
          `Export sauvegardé en cache : ${fileUri}. Partage manuel nécessaire.`
        );
      }
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Export impossible');
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    if (confirmation !== CONFIRMATION) {
      setError('Veuillez taper exactement : ' + CONFIRMATION);
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      await api.delete('/users/me');
      // Attendu : le coffre natif est asynchrone, et le garde de session lit le
      // jeton des le rendu suivant. Sans ca, il peut encore le trouver et
      // renvoyer vers un compte qui n'existe plus.
      await clearSession();
      router.replace('/');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Suppression impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <PageTitle subtitle={user?.email}>Mes données</PageTitle>

      {notice && (
        <View className="mb-4">
          <Alert kind="success">{notice}</Alert>
        </View>
      )}

      {error && (
        <View className="mb-4">
          <Alert kind="error">{error}</Alert>
        </View>
      )}

      <Card className="mb-6">
        <Text className="font-semibold text-gray-900 mb-1">Exporter mes données</Text>
        <Text className="text-sm text-gray-600 mb-3">
          Un fichier JSON avec votre profil, vos groupes, vos sessions et vos inscriptions.
        </Text>
        <Button testID="export-data" onPress={exportData} disabled={busy} full>
          Télécharger mes données
        </Button>
      </Card>

      <Card className="border-red-200">
        <Text className="font-semibold text-red-800 mb-1">Supprimer mon compte</Text>

        {/* Une liste a puces se compose a la main : React Native n'a ni <ul>
            ni marqueur de liste. */}
        <View className="mb-4 gap-2">
          <Text className="text-sm text-gray-700">
            Cette action est irréversible. Concrètement :
          </Text>
          {[
            'vos informations personnelles sont effacées ;',
            'les groupes dont vous êtes propriétaire sont transmis à un autre membre, ou supprimés si vous êtes seul ;',
            'vos sessions à venir sont annulées et les inscrits prévenus ;',
            "les sessions passées restent, pour ne pas effacer l'historique des autres joueurs.",
          ].map((item) => (
            <View key={item} className="flex-row gap-2">
              <Text className="text-sm text-gray-600">•</Text>
              <Text className="flex-1 text-sm text-gray-600">{item}</Text>
            </View>
          ))}
        </View>

        <Field label={`Tapez ${CONFIRMATION} pour confirmer`}>
          <Input
            testID="delete-confirmation"
            value={confirmation}
            onChangeText={(value) => setConfirmation(value)}
            placeholder={CONFIRMATION}
            autoCapitalize="characters"
            autoComplete="off"
            editable={!busy}
          />
        </Field>

        <View className="mt-4">
          <Button
            testID="delete-account"
            variant="danger"
            onPress={deleteAccount}
            disabled={busy || confirmation !== CONFIRMATION}
            full
          >
            {busy ? '…' : 'Supprimer définitivement mon compte'}
          </Button>
        </View>
      </Card>
    </Screen>
  );
}