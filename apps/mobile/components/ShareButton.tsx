import React, { useState } from 'react';
import { Button, View, Text, Linking, Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';

/**
 * Share button for mobile using expo-sharing.
 * Shares the URL with a title, falling back to copying to clipboard.
 */
export const ShareButton: React.FC<{ url: string; text: string }> = ({ url, text }) => {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    try {
      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Sharing not available');
      }

      // Prepare the URL to share
      let shareUrl = url;
      // If we are in a web environment (unlikely in native, but for completeness)
      if (typeof window !== 'undefined' && window.location.origin) {
        shareUrl = window.location.origin + url;
      }
      // On native, we could also try to use Constants.linkingOrigin, but we'll keep it simple.
      // The expo app should handle deep linking for relative URLs when shared.

      await Sharing.shareAsync(shareUrl, {
        dialogTitle: text,
        // For Android, the dialog title may be ignored, but it's fine for iOS.
      });
    } catch (error) {
      // Sharing failed or not available, fallback to copying to clipboard
      console.warn('Sharing not available or failed:', error);
      try {
        await Clipboard.setStringAsync(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (copyError) {
        console.warn('Copy to clipboard failed:', copyError);
      }
    }
  };

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.warn('Copy failed:', error);
    }
  };

  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <Button
        title="Partager"
        onPress={share}
        accessibilityLabel="Partager la session"
      />
      <Button
        title={copied ? 'Lien copié !' : 'Copier le lien'}
        onPress={copy}
        accessibilityLabel={copied ? 'Lien copié' : 'Copier le lien'}
      />
    </View>
  );
};