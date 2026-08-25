import React, { useState } from 'react';
import { View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api, mediaSrc } from 'five-api-client';
import { Alert, Avatar, Button } from 'five-ui';

/**
 * C-02 / G-01 : televersement d'une image de profil ou de groupe.
 *
 * Le fichier part en multipart. Sur React Native, `FormData` n'accepte pas un
 * `File` — il faut lui passer `{ uri, name, type }`, que le moteur convertit
 * lui-meme en piece jointe. Le type MIME est deduit de l'extension retenue
 * par le selecteur, car l'API n'accepte que jpeg, png et webp.
 */
const mimeFor = (uri: string) => {
  const extension = uri.split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
};

type Props = {
  endpoint: string;
  currentUrl?: string | null;
  label?: string;
  square?: boolean;
  onUploaded: (avatarUrl: string) => void;
};

export const AvatarUpload: React.FC<Props> = ({
  endpoint,
  currentUrl,
  label = 'Changer la photo',
  square = false,
  onUploaded,
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    setError(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Accès aux photos refusé. Vous pouvez l'autoriser dans les réglages.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      // L'API refuse au-dela de 2 Mo : mieux vaut compresser avant l'envoi
      // que faire echouer le televersement apres l'attente.
      quality: 0.7,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    setBusy(true);

    try {
      const body = new FormData();
      body.append('avatar', {
        uri: asset.uri,
        name: `avatar.${mimeFor(asset.uri).split('/')[1]}`,
        type: mimeFor(asset.uri),
      } as never);

      // Content-Type volontairement absent : axios doit poser lui-meme la
      // frontiere multipart, qu'on ne peut pas ecrire a la main.
      const response = await api.post(endpoint, body);
      onUploaded(response.data.avatarUrl);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Envoi impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <View className="flex-row items-center gap-4">
        <Avatar uri={mediaSrc(currentUrl)} size={64} square={square} />

        <Button variant="secondary" onPress={pick} disabled={busy} testID="avatar-pick">
          {busy ? 'Envoi…' : label}
        </Button>
      </View>

      {error ? (
        <View className="mt-2">
          <Alert kind="error">{error}</Alert>
        </View>
      ) : null}
    </View>
  );
};

export default AvatarUpload;
