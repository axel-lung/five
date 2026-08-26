import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { api } from 'five-api-client';

/**
 * N-01 : rend l'appareil joignable par notification push.
 *
 * Trois choses que ce module ne peut pas contourner, et qu'il signale plutot
 * que d'echouer en silence :
 *
 * - il faut un identifiant de projet EAS (`extra.eas.projectId`), sans lequel
 *   Expo ne delivre aucun jeton. Il s'obtient avec `eas init` ;
 * - le push ne fonctionne pas sur un emulateur ni un simulateur, seulement
 *   sur un appareil physique ;
 * - depuis SDK 53 il exige un development build sur Android, Expo Go n'y
 *   supportant plus les notifications distantes.
 *
 * L'absence de push ne doit jamais empecher d'utiliser l'application : toutes
 * les erreurs sont journalisees, aucune n'est propagee.
 */
const projectId =
  Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

/** Affiche la notification meme quand l'application est au premier plan. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

/**
 * Dernier jeton enregistre par cet appareil.
 *
 * Garde en memoire pour pouvoir le retirer a la deconnexion : le redemander a
 * Expo a ce moment-la echouerait si la permission vient d'etre revoquee, et
 * laisserait le telephone abonne au compte qui part.
 */
let currentToken: string | null = null;

export const registerPushToken = async (): Promise<string | null> => {
  if (!Device.isDevice) {
    console.warn('[push] appareil physique requis : aucun jeton demande.');
    return null;
  }

  if (!projectId) {
    console.warn("[push] extra.eas.projectId absent : lancez `eas init`.");
    return null;
  }

  try {
    const existing = await Notifications.getPermissionsAsync();
    const granted =
      existing.granted ||
      (await Notifications.requestPermissionsAsync()).granted;

    if (!granted) return null;

    // Android exige un canal declare, sinon rien n'est affiche.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Sessions',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    await api.post('/users/me/push-tokens', {
      token,
      platform: Platform.OS,
      // Les heures de silence sont en heure locale : le serveur ne peut pas
      // la deviner, l'appareil la declare.
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    currentToken = token;
    return token;
  } catch (error) {
    console.warn('[push] enregistrement impossible', error);
    return null;
  }
};

/**
 * Retrait a la deconnexion, pour ne pas alerter le suivant sur ce telephone.
 *
 * A appeler AVANT d'effacer la session : la requete a besoin du jeton
 * d'acces qui va disparaitre.
 */
export const unregisterCurrentDevice = async () => {
  if (!currentToken) return;

  try {
    await api.delete(`/users/me/push-tokens/${encodeURIComponent(currentToken)}`);
  } catch {
    // Sans importance : le serveur reattribuera ce jeton au prochain compte
    // qui se connectera depuis cet appareil.
  } finally {
    currentToken = null;
  }
};

/**
 * Enregistre l'appareil et ouvre la cible quand on touche une notification.
 *
 * `payload.eventId` est deja porte par toutes les notifications de session :
 * il n'y a rien a ajouter cote serveur pour que le tap mene au bon ecran.
 */
export const usePushRegistration = (authenticated: boolean) => {
  useEffect(() => {
    if (!authenticated) return undefined;

    registerPushToken();

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      if (typeof data?.eventId === 'string') {
        router.push(`/sessions/${data.eventId}` as never);
      }
    });

    return () => subscription.remove();
  }, [authenticated]);
};
