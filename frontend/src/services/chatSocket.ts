import api from './api';

/**
 * S-01 : transport temps reel du chat.
 *
 * La socket ne sert qu'a POUSSER. Elle ne porte aucun envoi — poster passe par
 * `POST /groups/:id/messages` — et surtout, le client ne se fie jamais a elle
 * pour la completude : apres chaque `ready`, l'ecran de chat redemande le
 * delta par `GET ?since=`. Une socket n'est pas une file durable ; c'est une
 * optimisation, et le delta REST est la garantie.
 *
 * Aucune dependance : `WebSocket` est integre a React Native comme au
 * navigateur.
 *
 * Ce fichier a un jumeau assume dans packages/api-client/src/chatSocket.ts,
 * pour l'app Expo. Cette app-ci n'est pas dans les workspaces de la racine et
 * ne peut pas resoudre ce paquet ; l'y brancher tirerait son singleton axios
 * dans une page qui a deja le sien (services/api.ts), soit deux
 * rafraichissements de jeton en course sur la meme rotation. Meme arbitrage
 * que pour api.ts et mediaSrc. Le contrat est epingle cote serveur
 * (backend/test/chatSocket.test.ts), pas par la discipline.
 */

export const CHAT_SOCKET_PATH = '/api/ws/chat';

export type ServerFrame =
  | { type: 'ready'; groups: string[]; serverTime: string }
  | { type: 'message'; message: any }
  | { type: 'message.deleted'; message: any }
  | { type: 'group.left'; groupId: string }
  | { type: 'error'; code: string; message: string }
  | { type: 'pong' };

export type SocketStatus = 'connecting' | 'open' | 'closed';

/** Compte suspendu : inutile d'insister, la reconnexion echouerait a l'infini. */
const CLOSE_SUSPENDED = 4403;

/** Paliers de reconnexion, en millisecondes. Le dernier se repete. */
const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 30000];

/**
 * Delai de grace avant de fermer une socket mise en veille.
 *
 * Un passage rapide d'une app a l'autre ne doit pas faire churner la
 * connexion ; une mise en arriere-plan durable, si (iOS la tuerait de toute
 * facon).
 */
const SUSPEND_GRACE_MS = 30_000;

/** `https://five.alng.fr/api` -> `wss://five.alng.fr/api/ws/chat`. */
const socketUrl = () => {
  const base = (api.defaults.baseURL ?? '').replace(/\/api$/, '');
  return `${base.replace(/^http/, 'ws')}${CHAT_SOCKET_PATH}`;
};

export const createChatSocket = (options: {
  url?: string;
  onFrame: (frame: ServerFrame) => void;
  onStatus?: (status: SocketStatus) => void;
  getToken?: () => Promise<string | null>;
}) => {
  const url = options.url ?? socketUrl();
  const getToken =
    options.getToken ?? (async () => localStorage.getItem('access_token'));

  let socket: WebSocket | null = null;
  let attempt = 0;
  let retryTimer: any = null;
  let graceTimer: any = null;
  let stopped = false;
  let suspended = false;

  const setStatus = (status: SocketStatus) => options.onStatus?.(status);

  const clearRetry = () => {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  };

  const scheduleRetry = () => {
    if (stopped || suspended || retryTimer) return;

    const base = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
    // Gigue : sans elle, toutes les applications reconnectent a la meme
    // seconde apres une coupure reseau, et le serveur se prend la vague.
    const delay = base + Math.random() * base * 0.3;
    attempt += 1;

    retryTimer = setTimeout(() => {
      retryTimer = null;
      connect();
    }, delay);
  };

  const connect = async () => {
    if (stopped || suspended || socket) return;

    const token = await getToken();
    // Pas de session : rien a ecouter, et reessayer en boucle ne ferait que
    // chauffer la batterie.
    if (!token) return;

    setStatus('connecting');
    const next = new WebSocket(url);
    socket = next;

    next.onopen = () => {
      // Le jeton voyage dans la premiere trame et non dans l'URL : une query
      // string atterrit dans les journaux d'acces des intermediaires. C'est
      // aussi la seule methode possible, ni le navigateur ni React Native ne
      // sachant poser un en-tete sur une WebSocket.
      next.send(JSON.stringify({ type: 'auth', token }));
    };

    next.onmessage = (event: any) => {
      let frame: ServerFrame;
      try {
        frame = JSON.parse(event.data);
      } catch {
        return;
      }

      // `ready` remet le compteur a zero : la connexion a vraiment abouti,
      // pas seulement le socket TCP.
      if (frame.type === 'ready') {
        attempt = 0;
        setStatus('open');
      }

      options.onFrame(frame);
    };

    next.onclose = (event: any) => {
      socket = null;
      setStatus('closed');

      if (event?.code === CLOSE_SUSPENDED) {
        stopped = true;
        return;
      }

      scheduleRetry();
    };

    // onerror est suivi d'un onclose sur les deux plateformes : la
    // reconnexion se joue la, une seule fois.
    next.onerror = () => undefined;
  };

  connect();

  return {
    /** Ferme definitivement. La socket ne se rouvrira pas. */
    close() {
      stopped = true;
      clearRetry();
      if (graceTimer) clearTimeout(graceTimer);
      socket?.close();
      socket = null;
    },

    /** Mise en veille (arriere-plan), avec le delai de grace. */
    suspend() {
      if (suspended) return;
      suspended = true;
      clearRetry();

      graceTimer = setTimeout(() => {
        socket?.close();
        socket = null;
      }, SUSPEND_GRACE_MS);
    },

    /** Retour au premier plan : reconnexion immediate, sans attendre le palier. */
    reconnectNow() {
      suspended = false;
      if (graceTimer) clearTimeout(graceTimer);
      graceTimer = null;
      clearRetry();
      attempt = 0;
      if (!socket) connect();
    },

    isOpen: () => socket?.readyState === 1,
  };
};

export type ChatSocket = ReturnType<typeof createChatSocket>;
