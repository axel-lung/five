import { api, createUser, createEvent, createGroup } from './helpers';

const authed = (token: string) => ({ Authorization: `Bearer ${token}` });

const block = (token: string, targetId: string) =>
  api().post(`/api/users/${targetId}/block`).set(authed(token));

const unblock = (token: string, targetId: string) =>
  api().delete(`/api/users/${targetId}/block`).set(authed(token));

const join = (token: string, eventId: string) =>
  api().post(`/api/events/${eventId}/join`).set(authed(token));

const invite = (token: string, groupId: string) =>
  api().post(`/api/groups/${groupId}/invitations`).set(authed(token)).send({});

const accept = (token: string, inviteToken: string) =>
  api().post(`/api/groups/invitations/${inviteToken}/accept`).set(authed(token));

describe('Blocage (D-06)', () => {
  it('bloque puis debloque un joueur', async () => {
    const me = await createUser();
    const other = await createUser();

    expect((await block(me.accessToken, other.id)).status).toBe(201);

    const list = await api().get('/api/users/me/blocks').set(authed(me.accessToken));
    expect(list.body.map((b: any) => b.user.id)).toContain(other.id);

    expect((await unblock(me.accessToken, other.id)).status).toBe(200);

    const after = await api().get('/api/users/me/blocks').set(authed(me.accessToken));
    expect(after.body).toHaveLength(0);
  });

  it('est idempotent', async () => {
    const me = await createUser();
    const other = await createUser();

    await block(me.accessToken, other.id);
    expect((await block(me.accessToken, other.id)).status).toBe(200);
  });

  it('refuse de se bloquer soi-meme', async () => {
    const me = await createUser();
    expect((await block(me.accessToken, me.id)).status).toBe(400);
  });

  it('n-expose que ceux que j-ai bloques, jamais qui m-a bloque', async () => {
    const me = await createUser();
    const other = await createUser();
    await block(other.accessToken, me.id);

    const list = await api().get('/api/users/me/blocks').set(authed(me.accessToken));
    expect(list.body).toHaveLength(0);
  });

  it('empeche un joueur bloque de rejoindre l-evenement de l-organisateur', async () => {
    const organizer = await createUser();
    const player = await createUser();
    const event = await createEvent(organizer.accessToken);

    await block(organizer.accessToken, player.id);

    expect((await join(player.accessToken, event.id)).status).toBe(404);
  });

  // L'effet doit jouer dans les deux sens : bloquer quelqu-un ne doit pas
  // laisser cette personne continuer a s-inscrire chez vous.
  it('joue aussi quand c-est le joueur qui a bloque l-organisateur', async () => {
    const organizer = await createUser();
    const player = await createUser();
    const event = await createEvent(organizer.accessToken);

    await block(player.accessToken, organizer.id);

    expect((await join(player.accessToken, event.id)).status).toBe(404);
  });

  it('laisse rejoindre apres levee du blocage', async () => {
    const organizer = await createUser();
    const player = await createUser();
    const event = await createEvent(organizer.accessToken);

    await block(organizer.accessToken, player.id);
    await unblock(organizer.accessToken, player.id);

    expect((await join(player.accessToken, event.id)).status).toBe(201);
  });

  it('empeche d-accepter l-invitation de quelqu-un qui vous a bloque', async () => {
    const owner = await createUser();
    const invited = await createUser();
    const group = await createGroup(owner.accessToken);
    const invitation = await invite(owner.accessToken, group.id);

    await block(owner.accessToken, invited.id);

    expect((await accept(invited.accessToken, invitation.body.token)).status).toBe(404);
  });
});

describe('Signalements (S-05)', () => {
  it('enregistre un signalement', async () => {
    const me = await createUser();
    const other = await createUser();

    const res = await api()
      .post('/api/reports')
      .set(authed(me.accessToken))
      .send({ targetType: 'user', targetId: other.id, reason: 'spam' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('open');
  });

  it('refuse une cible de type inconnu', async () => {
    const me = await createUser();
    const other = await createUser();

    const res = await api()
      .post('/api/reports')
      .set(authed(me.accessToken))
      .send({ targetType: 'message', targetId: other.id, reason: 'spam' });

    expect(res.status).toBe(400);
  });

  it('refuse de se signaler soi-meme', async () => {
    const me = await createUser();

    const res = await api()
      .post('/api/reports')
      .set(authed(me.accessToken))
      .send({ targetType: 'user', targetId: me.id, reason: 'spam' });

    expect(res.status).toBe(400);
  });

  it('exige une authentification', async () => {
    const res = await api()
      .post('/api/reports')
      .send({ targetType: 'user', targetId: '11111111-1111-1111-1111-111111111111', reason: 'x' });

    expect(res.status).toBe(401);
  });
});
