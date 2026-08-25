import React, { useState } from 'react';
import { Text, View, ScrollView, Platform, Alert as RNAlert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Link, useRouter } from 'expo-router';
import { api, clearSession, useCurrentUser } from 'five-api-client';
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  Loading,
  PageTitle,
} from 'five-ui';
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
      clearSession();
      router.replace('/');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Suppression impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      contentContainerClassName="px-4 py-6"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
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
        <h2 className="font-semibold text-gray-900 mb-1">Exporter mes données</h2>
        <p className="text-sm text-gray-600 mb-3">
          Un fichier JSON avec votre profil, vos groupes, vos sessions et vos inscriptions.
        </p>
        <Button
          testID="export-data"
          title="Télécharger mes données"
          onPress={exportData}
          disabled={busy}
        />
      </Card>

      <Card className="border-red-200">
        <h2 className="font-semibold text-red-800 mb-1">Supprimer mon compte</h2>
        <div className="text-sm text-gray-700 space-y-2 mb-4">
          <p>Cette action est irréversible. Concrètement :</p>
          <ul className="list-disc list-inside space-y-1 text-gray-600">
            <li>vos informations personnelles sont effacées&nbsp;;</li>
            <li>
              les groupes dont vous êtes propriétaire sont transmis à un autre membre, ou
              supprimés si vous êtes seul&nbsp;;
            </li>
            <li>vos sessions à venir sont annulées et les inscrits prévenus&nbsp;;</li>
            <li>
              les sessions passées restent, pour ne pas effacer l'historique des autres
              joueurs.
            </li>
          </ul>
        </div>

        <label htmlFor="confirmation" className="block text-sm font-medium text-gray-700 mb-1">
          Tapez <span className="font-mono font-bold">{CONFIRMATION}</span> pour confirmer
        </label>
        <Input
          testID="delete-confirmation"
          value={confirmation}
          onChangeText={(value) => setConfirmation(value)}
          placeholder="Tapez SUPPRIMER pour confirmer"
          autoComplete="off"
          editable={!busy}
        />

        <Button
          testID="delete-account"
          title={busy ? '…' : 'Supprimer définitivement mon compte'}
          onPress={deleteAccount}
          disabled={busy || confirmation !== CONFIRMATION}
        />
      </Card>
    </ScrollView>
  );
}