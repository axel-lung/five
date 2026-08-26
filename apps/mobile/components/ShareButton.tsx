import React, { useState } from 'react';
import { Platform, Share, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { publicUrl } from 'five-api-client';
import { Button } from 'five-ui';

/**
 * S-03 : partage externe vers WhatsApp.
 *
 * `Share` de react-native, et non `expo-sharing` : ce dernier partage des
 * FICHIERS depuis une URI locale, pas du texte ni un lien. Lui passer une URL
 * echoue sur les deux plateformes.
 *
 * Le lien partage est absolu et pointe sur le site web : il atterrit chez des
 * gens qui n'ont pas l'application, et un chemin relatif ne leur servirait a
 * rien.
 */
export const ShareButton: React.FC<{ url: string; text: string }> = ({ url, text }) => {
  const [copied, setCopied] = useState(false);
  const absolute = publicUrl(url);

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(absolute);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const share = async () => {
    // react-native-web n'implemente pas Share : sur le web on passe par
    // l'API de partage du navigateur, et a defaut par le presse-papier.
    if (Platform.OS === 'web') {
      const native = (globalThis as any).navigator?.share;
      if (native) {
        try {
          await native.call((globalThis as any).navigator, { text, url: absolute });
        } catch {
          // Partage referme par l'utilisateur : ne pas enchainer sur autre
          // chose dans son dos.
        }
        return;
      }
      await copy();
      return;
    }

    try {
      // Android ignore `url` et n'expose que `message` : le lien y est donc
      // aussi, sans quoi le partage arriverait sans adresse.
      await Share.share({ message: `${text} ${absolute}`, url: absolute });
    } catch {
      await copy();
    }
  };

  return (
    <View className="gap-2">
      <Button onPress={share} full>
        Partager
      </Button>
      <Button variant="secondary" onPress={copy} full>
        {copied ? 'Lien copié !' : 'Copier le lien'}
      </Button>
    </View>
  );
};

export default ShareButton;
