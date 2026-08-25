import type { Server as HttpServer } from 'http';
import { Op } from 'sequelize';
import { WebSocket, WebSocketServer } from 'ws';
import { GroupMemberModel as GroupMember, UserBlockModel as UserBlock } from '../models';
import { verifyAccessToken } from '../middleware/auth';
import { CHAT_SOCKET_PATH, CLOSE_CODES, ServerFrame } from './protocol';

/**
 * S-01 : transport temps reel du chat de groupe.
 *
 * La socket ne fait que POUSSER ce que REST a deja ecrit. Elle n'accepte
 * aucune ecriture, et le client ne s'y fie jamais pour la completude : apres
 * chaque reconnexion il redemande le delta par
 * `GET /groups/:id/messages?since=`. Une socket n'est pas une file durable —
 * c'est une optimisation, et le delta REST est la garantie.
 *
 * MONO-INSTANCE. Le registre des salons est une Map en processus : correct
 * uniquement parce qu'un seul conteneur backend tourne, la meme hypothese que
 * documente deja src/db/migrator.ts pour les migrations au demarrage. Ajouter
 * une replique sans rien changer ferait SILENCIEUSEMENT a moitie marcher le
 * chat : un message poste sur l'instance A n'atteindrait jamais les sockets de
 * l'instance B. Ce qu'il faudrait alors : que publishMessage publie sur un bus
 * (Redis PUBLISH, ou LISTEN/NOTIFY de Postgres au prix d'un plafond de 8 ko)
 * dont chaque instance ferait la diffusion locale. Pas de session collante
 * necessaire : la socket ne porte aucun etat au-dela de ses salons.
 *
 * Consolation du choix de conception : le pire cas d'un deploiement
 * multi-instance sans bus reste « les messages n'apparaissent qu'a la
 * reconnexion », jamais « les messages sont perdus ».
 */

/** Duree de vie maximale d'une socket authentifiee. */
const SOCKET_TTL_MS = 12 * 60 * 60 * 1000;

/** Delai laisse a une socket pour envoyer sa trame d'authentification. */
const AUTH_GRACE_MS = 5_000;

/** Periode du battement de coeur. Tient sous l'idleTimeout Traefik (180 s). */
const HEARTBEAT_MS = 30_000;

/** Periode de revalidation paresseuse des appartenances et des blocages. */
const REVALIDATE_MS = 5 * 60_000;

interface ChatSocket extends WebSocket {
  userId?: string;
  /** Groupes dont cette socket recoit les messages. */
  groups?: Set<string>;
  /** Comptes bloques dans un sens ou dans l'autre : leurs messages sont sautes. */
  blocked?: Set<string>;
  isAlive?: boolean;
  authTimer?: NodeJS.Timeout;
  ttlTimer?: NodeJS.Timeout;
}

/** groupId -> sockets a l'ecoute. */
const rooms = new Map<string, Set<ChatSocket>>();

/** userId -> ses sockets, tous appareils confondus. */
const byUser = new Map<string, Set<ChatSocket>>();

const send = (socket: ChatSocket, frame: ServerFrame) => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(frame));
  }
};

const addTo = <K, V>(map: Map<K, Set<V>>, key: K, value: V) => {
  const set = map.get(key) ?? new Set<V>();
  set.add(value);
  map.set(key, set);
};

const removeFrom = <K, V>(map: Map<K, Set<V>>, key: K, value: V) => {
  const set = map.get(key);
  if (!set) return;
  set.delete(value);
  if (set.size === 0) map.delete(key);
};

/** Retire une socket de tous les registres. */
const unregister = (socket: ChatSocket) => {
  socket.groups?.forEach((groupId) => removeFrom(rooms, groupId, socket));
  if (socket.userId) removeFrom(byUser, socket.userId, socket);
  if (socket.authTimer) clearTimeout(socket.authTimer);
  if (socket.ttlTimer) clearTimeout(socket.ttlTimer);
};

/** Lit en base les salons et les blocages d'un utilisateur. */
const loadContext = async (userId: string) => {
  const [memberships, blocks] = await Promise.all([
    GroupMember.findAll({ where: { userId }, attributes: ['groupId'] }),
    UserBlock.findAll({
      where: { [Op.or]: [{ blockerId: userId }, { blockedId: userId }] },
      attributes: ['blockerId', 'blockedId'],
    }),
  ]);

  return {
    groups: new Set(memberships.map((m: any) => m.groupId as string)),
    blocked: new Set(
      blocks.map((b: any) => (b.blockerId === userId ? b.blockedId : b.blockerId) as string)
    ),
  };
};

/** Reinscrit une socket dans les salons correspondant a son contexte. */
const applyContext = (
  socket: ChatSocket,
  context: { groups: Set<string>; blocked: Set<string> }
) => {
  socket.groups?.forEach((groupId) => {
    if (!context.groups.has(groupId)) removeFrom(rooms, groupId, socket);
  });

  context.groups.forEach((groupId) => addTo(rooms, groupId, socket));

  socket.groups = context.groups;
  socket.blocked = context.blocked;
};

// --- Diffusion -------------------------------------------------------------

/**
 * Pousse un message vers les membres connectes du groupe.
 *
 * Sans effet tant qu'aucun serveur n'est attache : le registre est vide, et
 * les tests REST n'ouvrent aucune socket. Le controleur peut donc l'appeler
 * sans condition.
 *
 * Les blocages sont lus dans le cache de chaque socket : interroger la base
 * par destinataire et par message rendrait un groupe bavard tres couteux.
 */
export const publishMessage = (groupId: string, message: any) => {
  const room = rooms.get(groupId);
  if (!room) return;

  room.forEach((socket) => {
    // Pas de suppression de l'echo par utilisateur : les autres appareils de
    // l'expediteur doivent recevoir la trame. Le client dedoublonne par id.
    if (socket.blocked?.has(message?.authorId)) return;
    send(socket, { type: 'message', message });
  });
};

/** Meme chose pour une suppression : la pierre tombale voyage comme un message. */
export const publishDeletion = (groupId: string, message: any) => {
  const room = rooms.get(groupId);
  if (!room) return;

  room.forEach((socket) => {
    send(socket, { type: 'message.deleted', message });
  });
};

// --- Invalidation poussee --------------------------------------------------

/**
 * Sort un utilisateur d'un salon sur-le-champ.
 *
 * Appelee au retrait d'un membre et au depart volontaire. Sans elle, la
 * personne exclue continuerait de recevoir la conversation jusqu'a la
 * prochaine revalidation.
 */
export const dropFromRoom = (groupId: string, userId: string) => {
  byUser.get(userId)?.forEach((socket) => {
    if (!socket.groups?.has(groupId)) return;
    socket.groups.delete(groupId);
    removeFrom(rooms, groupId, socket);
    send(socket, { type: 'group.left', groupId });
  });
};

/** Vide un salon de tout le monde : le groupe vient d'etre supprime. */
export const closeRoom = (groupId: string) => {
  const room = rooms.get(groupId);
  if (!room) return;

  [...room].forEach((socket) => {
    socket.groups?.delete(groupId);
    send(socket, { type: 'group.left', groupId });
  });
  rooms.delete(groupId);
};

/** Relit le contexte d'un utilisateur — typiquement apres qu'il a rejoint un groupe. */
export const refreshMembership = async (userId: string) => {
  const sockets = byUser.get(userId);
  if (!sockets || sockets.size === 0) return;

  const context = await loadContext(userId);
  sockets.forEach((socket) =>
    applyContext(socket, { groups: new Set(context.groups), blocked: new Set(context.blocked) })
  );
};

/**
 * Ferme toutes les sockets d'un compte.
 *
 * Necessaire a la suspension : authenticateToken ne relit jamais la base, la
 * socket d'un compte suspendu ecouterait donc jusqu'a sa propre chute.
 */
export const disconnectUser = (userId: string, code: number = CLOSE_CODES.SUSPENDED) => {
  byUser.get(userId)?.forEach((socket) => {
    send(socket, { type: 'error', code: 'suspended', message: 'Account suspended' });
    socket.close(code);
  });
};

// --- Serveur ---------------------------------------------------------------

/**
 * Attache le serveur WebSocket a un serveur HTTP deja construit.
 *
 * `app.ts` n'est pas touche : il doit rester sans ecoute reseau pour
 * supertest. L'attachement se fait depuis les deux points d'entree reels,
 * server.ts et devserver.ts.
 */
export const attachChatSocket = (server: HttpServer) => {
  // `noServer` et non `{ server }` : cela permet de refuser proprement une
  // requete avant l'upgrade, et de ne repondre que sur notre chemin — avec
  // `{ server }`, la bibliotheque accepterait tout upgrade sur toute route.
  const wss = new WebSocketServer({ noServer: true });

  const onUpgrade = (request: any, socket: any, head: Buffer) => {
    const path = (request.url ?? '').split('?')[0];
    if (path !== CHAT_SOCKET_PATH) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
  };

  server.on('upgrade', onUpgrade);

  wss.on('connection', (raw: WebSocket) => {
    const socket = raw as ChatSocket;
    socket.isAlive = true;
    socket.on('pong', () => {
      socket.isAlive = true;
    });

    // Une socket non authentifiee ne doit pas pouvoir rester ouverte : elle ne
    // coute rien a ouvrir et tout a garder.
    socket.authTimer = setTimeout(() => socket.close(CLOSE_CODES.UNAUTHORIZED), AUTH_GRACE_MS);

    socket.on('message', async (data) => {
      let frame: any;
      try {
        frame = JSON.parse(data.toString());
      } catch {
        return socket.close(CLOSE_CODES.BAD_FRAME);
      }

      if (!socket.userId) {
        // Le jeton voyage dans la premiere trame, et non dans l'URL : une
        // query string atterrit dans le journal d'acces de Traefik et de tout
        // intermediaire, alors qu'un access token vaut une heure. C'est aussi
        // la seule methode qui marche a l'identique en navigateur et en React
        // Native, ou WebSocket ne sait pas poser d'en-tete Authorization.
        if (frame?.type !== 'auth' || typeof frame.token !== 'string') {
          return socket.close(CLOSE_CODES.BAD_FRAME);
        }

        const user = verifyAccessToken(frame.token);
        if (!user) {
          send(socket, { type: 'error', code: 'unauthorized', message: 'Invalid token' });
          return socket.close(CLOSE_CODES.UNAUTHORIZED);
        }

        clearTimeout(socket.authTimer);
        socket.userId = user.id;
        addTo(byUser, user.id, socket);

        const context = await loadContext(user.id);
        applyContext(socket, context);

        // La socket ne meurt pas a l'expiration du jeton : c'est un canal de
        // lecture, et toute action mutante repasse par REST, qui exige un
        // jeton frais. Mais sans plafond, un jeton d'une heure deviendrait un
        // droit de lecture indefini sur les groupes ou l'utilisateur etait au
        // moment de la connexion. Le client se reconnecte tout seul.
        socket.ttlTimer = setTimeout(
          () => socket.close(CLOSE_CODES.UNAUTHORIZED),
          SOCKET_TTL_MS
        );

        return send(socket, {
          type: 'ready',
          groups: [...(socket.groups ?? [])],
          serverTime: new Date().toISOString(),
        });
      }

      if (frame?.type === 'ping') {
        return send(socket, { type: 'pong' });
      }

      // Aucune autre trame n'est prevue : envoyer un message passe par REST.
      send(socket, { type: 'error', code: 'bad_frame', message: 'Unsupported frame' });
    });

    socket.on('close', () => unregister(socket));
    // Une socket en erreur ne declenche pas toujours 'close' : sans ceci, elle
    // resterait inscrite dans les salons et recevrait dans le vide.
    socket.on('error', () => unregister(socket));
  });

  // Un socket TCP a demi ouvert — un telephone entre dans un tunnel — parait
  // parfaitement connecte. Le ping applicatif est le seul moyen de le voir.
  const heartbeat = setInterval(() => {
    wss.clients.forEach((client) => {
      const socket = client as ChatSocket;
      if (socket.isAlive === false) {
        socket.terminate();
        return;
      }
      socket.isAlive = false;
      socket.ping();
    });
  }, HEARTBEAT_MS);

  // Filet de securite derriere l'invalidation poussee : elle couvre les
  // chemins qu'on aura oublie d'instrumenter.
  const revalidate = setInterval(() => {
    byUser.forEach((_sockets, userId) => {
      refreshMembership(userId).catch(() => undefined);
    });
  }, REVALIDATE_MS);

  // Les deux intervalles vivent ici et non au niveau module : un intervalle de
  // module laisserait un handle ouvert et ferait pendre jest a chaque run.
  return {
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(heartbeat);
        clearInterval(revalidate);
        server.off('upgrade', onUpgrade);
        wss.clients.forEach((client) => client.terminate());
        wss.close(() => resolve());
      }),
  };
};
