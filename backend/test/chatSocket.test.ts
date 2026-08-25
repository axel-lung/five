import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import WebSocket from 'ws';
import { app } from '../src/app';
import { attachChatSocket } from '../src/ws';
import { CHAT_SOCKET_PATH, CLOSE_CODES } from '../src/ws/protocol';
import { api, createUser, createGroup } from './helpers';

/**
 * Transport temps reel du chat.
 *
 * Hors supertest : celui-ci ne sait pas negocier un upgrade WebSocket. On
 * monte donc un vrai serveur HTTP sur un port libre, et on s'y connecte avec
 * le paquet `ws` cote client.
 *
 * Ce qui compte ici n'est pas la plomberie du transport mais la frontiere
 * d'autorisation : qu'un message n'atteigne QUE les membres du groupe, et
 * qu'un retrait la referme immediatement.
 */

let server: Server;
let chat: { close: () => Promise<void> };
let port: number;

beforeAll(async () => {
  server = createServer(app);
  chat = attachChatSocket(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  // Sans ces deux fermetures, jest garde des handles ouverts et pend.
  await chat.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

type Client = ReturnType<typeof open>;

const opened: WebSocket[] = [];

const open = () => {
  const socket = new WebSocket(`ws://127.0.0.1:${port}${CHAT_SOCKET_PATH}`);
  opened.push(socket);

  const frames: any[] = [];
  socket.on('message', (data) => frames.push(JSON.parse(data.toString())));

  const closed = new Promise<number>((resolve) => socket.on('close', resolve));
  const ready = new Promise<void>((resolve, reject) => {
    socket.on('open', () => resolve());
    socket.on('error', reject);
  });

  /** Attend une trame d'un type donne, ou echoue au bout du delai. */
  const next = async (type: string, timeoutMs = 2000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const index = frames.findIndex((frame) => frame.type === type);
      if (index >= 0) return frames.splice(index, 1)[0];
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`aucune trame « ${type} » recue en ${timeoutMs} ms`);
  };

  const has = (type: string) => frames.some((frame) => frame.type === type);

  return { socket, frames, closed, ready, next, has };
};

/** Ouvre une socket et l'authentifie, jusqu'a la trame `ready`. */
const connect = async (token: string) => {
  const client = open();
  await client.ready;
  client.socket.send(JSON.stringify({ type: 'auth', token }));
  const readyFrame = await client.next('ready');
  return { ...client, readyFrame };
};

/**
 * Laisse le temps a une trame d'arriver avant d'affirmer qu'elle n'arrive pas.
 * Sans cette attente, l'assertion negative passerait meme si la trame etait en
 * vol.
 */
const settle = () => new Promise((resolve) => setTimeout(resolve, 250));

afterEach(() => {
  opened.forEach((socket) => socket.close());
  opened.length = 0;
});

describe('Socket de chat — authentification', () => {
  it('ferme une socket qui parle avant de s-authentifier', async () => {
    const client = open();
    await client.ready;

    client.socket.send(JSON.stringify({ type: 'ping' }));

    expect(await client.closed).toBe(CLOSE_CODES.BAD_FRAME);
  });

  it('refuse un jeton invalide', async () => {
    const client = open();
    await client.ready;

    client.socket.send(JSON.stringify({ type: 'auth', token: 'pas-un-jeton' }));

    expect(await client.closed).toBe(CLOSE_CODES.UNAUTHORIZED);
  });

  it('refuse un refresh token la ou un access token est attendu', async () => {
    const user = await createUser();
    const client = open();
    await client.ready;

    // Le refresh token vaut trente jours : l'accepter ici en ferait un droit
    // de lecture d'un mois.
    client.socket.send(JSON.stringify({ type: 'auth', token: user.refreshToken }));

    expect(await client.closed).toBe(CLOSE_CODES.UNAUTHORIZED);
  });

  it('annonce les groupes de l-utilisateur a l-authentification', async () => {
    const owner = await createUser();
    const group = await createGroup(owner.accessToken);

    const client = await connect(owner.accessToken);

    expect(client.readyFrame.groups).toContain(group.id);
    expect(client.readyFrame.serverTime).toBeDefined();
  });
});

describe('Socket de chat — diffusion', () => {
  const join = async (ownerToken: string, groupId: string, memberToken: string) => {
    const invitation = await api()
      .post(`/api/groups/${groupId}/invitations`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});

    await api()
      .post(`/api/groups/invitations/${invitation.body.token}/accept`)
      .set('Authorization', `Bearer ${memberToken}`);
  };

  it('delivre un message aux membres et a eux seuls', async () => {
    const owner = await createUser();
    const member = await createUser();
    const outsider = await createUser();
    const group = await createGroup(owner.accessToken);
    await join(owner.accessToken, group.id, member.accessToken);

    const memberSocket = await connect(member.accessToken);
    const outsiderSocket = await connect(outsider.accessToken);

    await api()
      .post(`/api/groups/${group.id}/messages`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ body: 'on joue mardi' });

    const frame = await memberSocket.next('message');
    expect(frame.message.body).toBe('on joue mardi');

    await settle();
    // La frontiere d'autorisation : c'est cette assertion-la qui compte.
    expect(outsiderSocket.has('message')).toBe(false);
  });

  it('delivre aussi les suppressions, pour que la tombale se propage', async () => {
    const owner = await createUser();
    const member = await createUser();
    const group = await createGroup(owner.accessToken);
    await join(owner.accessToken, group.id, member.accessToken);

    const memberSocket = await connect(member.accessToken);

    const sent = await api()
      .post(`/api/groups/${group.id}/messages`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ body: 'a effacer' });

    await memberSocket.next('message');

    await api()
      .delete(`/api/groups/${group.id}/messages/${sent.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    const frame = await memberSocket.next('message.deleted');
    expect(frame.message.id).toBe(sent.body.id);
    expect(frame.message.body).toBeNull();
  });

  it('coupe la diffusion des qu-un membre est retire', async () => {
    const owner = await createUser();
    const member = await createUser();
    const group = await createGroup(owner.accessToken);
    await join(owner.accessToken, group.id, member.accessToken);

    const memberSocket = await connect(member.accessToken);

    await api()
      .delete(`/api/groups/${group.id}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ memberId: member.id });

    const left = await memberSocket.next('group.left');
    expect(left.groupId).toBe(group.id);

    await api()
      .post(`/api/groups/${group.id}/messages`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ body: 'apres son depart' });

    await settle();
    // Sans l'invalidation poussee, la personne exclue lirait encore la
    // conversation jusqu'a la revalidation periodique — cinq minutes.
    expect(memberSocket.has('message')).toBe(false);
  });

  it('ouvre le chat a un nouvel arrivant sans qu-il ait a se reconnecter', async () => {
    const owner = await createUser();
    const newcomer = await createUser();
    const group = await createGroup(owner.accessToken);

    const newcomerSocket = await connect(newcomer.accessToken);
    expect(newcomerSocket.readyFrame.groups).not.toContain(group.id);

    await join(owner.accessToken, group.id, newcomer.accessToken);

    await api()
      .post(`/api/groups/${group.id}/messages`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ body: 'bienvenue' });

    const frame = await newcomerSocket.next('message');
    expect(frame.message.body).toBe('bienvenue');
  });

  it('ne pousse pas les messages d-un compte bloque', async () => {
    const owner = await createUser();
    const blocked = await createUser();
    const group = await createGroup(owner.accessToken);
    await join(owner.accessToken, group.id, blocked.accessToken);

    await api()
      .post(`/api/users/${blocked.id}/block`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({});

    // La socket est ouverte apres le blocage : elle en charge le cache a
    // l'authentification.
    const ownerSocket = await connect(owner.accessToken);

    await api()
      .post(`/api/groups/${group.id}/messages`)
      .set('Authorization', `Bearer ${blocked.accessToken}`)
      .send({ body: 'invisible' });

    await settle();
    expect(ownerSocket.has('message')).toBe(false);
  });
});
