import { Alert } from 'react-native';
import type { ConfirmOptions } from './confirm';

/**
 * Boite de dialogue native, en remplacement de `window.confirm`.
 *
 * `onDismiss` est indispensable : sur Android, le bouton retour ferme la boite
 * sans declencher aucun bouton. Sans lui, la promesse resterait en attente
 * pour toujours et l'ecran appelant se figerait.
 */
export function confirmAsync(
  message: string,
  options: ConfirmOptions = {}
): Promise<boolean> {
  const {
    title = 'Confirmer',
    confirmLabel = 'Confirmer',
    cancelLabel = 'Annuler',
    destructive = false,
  } = options;

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
