import { env } from '../config/env';

/**
 * N-01 : envoi des notifications push, via le service Expo.
 *
 * Derriere une interface, comme `services/mailer.ts` : l'implementation muette
 * sert aux tests et au developpement, et rien dans les controleurs ne connait
 * Expo. Le service Expo Push est gratuit et n'exige pas de cle ; un jeton
 * d'acces reste possible, et recommande en production.
 */
export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export interface Push {
  send(messages: PushMessage[]): Promise<void>;
}

const EXPO_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

/** Expo refuse les lots de plus de 100 messages. */
const BATCH_SIZE = 100;

const expoPush: Push = {
  async send(messages) {
    if (messages.length === 0) return;

    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);

      try {
        const response = await fetch(EXPO_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(env.expoAccessToken
              ? { Authorization: `Bearer ${env.expoAccessToken}` }
              : {}),
          },
          body: JSON.stringify(batch),
        });

        if (!response.ok) {
          console.error(`[push] Expo a repondu ${response.status}`);
        }
      } catch (error) {
        // Un push perdu ne doit jamais faire echouer l'action metier qui l'a
        // declenche : la notification est deja ecrite en base, et le joueur
        // la verra dans son centre de notifications.
        console.error('[push] envoi impossible', error);
      }
    }
  },
};

/** N'envoie rien, et ne touche pas au reseau. */
const silentPush: Push = {
  async send() {
    return undefined;
  },
};

export const push: Push = env.nodeEnv === 'test' ? silentPush : expoPush;
