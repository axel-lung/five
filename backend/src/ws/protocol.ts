/**
 * Protocole du chat temps reel.
 *
 * Ce fichier est le contrat : il est recopie a l'identique cote client
 * (packages/api-client/src/chatSocket.ts et frontend/src/services/chatSocket.ts).
 * Le garder minuscule est volontaire — c'est ce qui rend la duplication
 * supportable.
 */

/** Chemin de la socket. Doit rester sous /api : c'est le prefixe route par Traefik. */
export const CHAT_SOCKET_PATH = '/api/ws/chat';

/**
 * Trames client vers serveur.
 *
 * Aucune trame d'envoi de message : poster passe par POST /messages, qui
 * porte deja la validation, la limitation de debit, l'idempotence par nonce
 * et des codes d'erreur typés. Dupliquer tout cela sur la socket doublerait
 * la surface d'attaque pour economiser un aller-retour imperceptible.
 */
export type ClientFrame =
  | { type: 'auth'; token: string }
  | { type: 'ping' };

/** Trames serveur vers client. */
export type ServerFrame =
  // `serverTime` existe pour que le client ne calcule jamais un curseur
  // `since` depuis sa propre horloge, qui derive.
  | { type: 'ready'; groups: string[]; serverTime: string }
  | { type: 'message'; message: unknown }
  | { type: 'message.deleted'; message: unknown }
  | { type: 'group.left'; groupId: string }
  | { type: 'error'; code: 'unauthorized' | 'bad_frame' | 'suspended'; message: string }
  | { type: 'pong' };

/**
 * Codes de fermeture applicatifs.
 *
 * La plage 4000-4999 est celle laissee aux applications par la RFC 6455 ;
 * en dehors, le navigateur refuse le code.
 */
export const CLOSE_CODES = {
  /** Trame illisible ou hors sequence. */
  BAD_FRAME: 4000,
  /** Non authentifie, jeton invalide, ou duree de vie de la socket atteinte. */
  UNAUTHORIZED: 4401,
  /** Compte suspendu : le client ne doit pas se reconnecter. */
  SUSPENDED: 4403,
} as const;
