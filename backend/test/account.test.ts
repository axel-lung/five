import { api, createUser, createEvent, createGroup } from './helpers';

const authed = (token: string) => ({ Authorization: `Bearer ${token}` });

const invite = (token: string, groupId: string) =>
  api().post(`/api/groups/${groupId}/invitations`).set(authed(token)).send({});

const accept = (token: string, inviteToken: string) =>
  api().post(`/api/groups/invitations/${inviteToken}/accept`).set(authed(token));

const deleteAccount = (token: string) =>
  api().delete('/api/users/me').set(authed(token));

/** Ajoute un membre au groupe via une invitation, comme un vrai parcours. */
const addMember = async (ownerToken: string, groupId: string, memberToken: string) => {
  const invitation = await invite(ownerToken, groupId);
  await accept(memberToken, invitation.body.token);
};

describe('Consentements a l-inscription (C-01)', () => {
  it('refuse une inscription sans acceptation des CGU', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ email: `no-tos-${Date.now()}@example.com`, password: 'Test1234!' });

    expect(res.status).toBe(400);
  });

  it('refuse un refus explicite des CGU', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({
        email: `refus-${Date.now()}@example.com`,
        password: 'Test1234!',
        acceptTos: false,
      });

    expect(res.status).toBe(400);
  });

  // Le marketing ne doit jamais conditionner la creation de compte.
  it('accepte une inscription sans consentement marketing', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({
        email: `sans-marketing-${Date.now()}@example.com`,
        password: 'Test1234!',
        acceptTos: true,
      });

    expect(res.status).toBe(201);
  });
});

describe('Verification d-email (C-05)', () => {
  it('verifie l-adresse via le token recu', async () => {
    const user = await createUser();

    const request = await api().post('/api/auth/verify-email').set(authed(user.accessToken));
    expect(request.status).toBe(200);
    expect(request.body.token).toBeDefined();

    const verify = await api().post(`/api/auth/verify-email/${request.body.token}`);
    expect(verify.status).toBe(200);

    const profile = await api().get('/api/users/profile').set(authed(user.accessToken));
    expect(profile.body.emailVerified).toBe(true);
  });

  it('refuse un token inconnu', async () => {
    const res = await api().post('/api/auth/verify-email/11111111-1111-1111-1111-111111111111');
    expect(res.status).toBe(404);
  });

  it('ne renvoie jamais le token de verification dans le profil', async () => {
    const user = await createUser();
    await api().post('/api/auth/verify-email').set(authed(user.accessToken));

    const profile = await api().get('/api/users/profile').set(authed(user.accessToken));
    expect(profile.body).not.toHaveProperty('emailVerificationToken');
  });

  it('freine deux demandes consecutives', async () => {
    const user = await createUser();

    await api().post('/api/auth/verify-email').set(authed(user.accessToken));
    const second = await api().post('/api/auth/verify-email').set(authed(user.accessToken));

    expect(second.status).toBe(429);
  });
});

describe('Export des donnees (C-06)', () => {
  it('renvoie profil, groupes, evenements et inscriptions', async () => {
    const user = await createUser();
    const group = await createGroup(user.accessToken);
    const event = await createEvent(user.accessToken, { groupId: group.id });

    const res = await api().get('/api/users/me/export').set(authed(user.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.profile.id).toBe(user.id);
    expect(res.body.groups.map((g: any) => g.group.id)).toContain(group.id);
    expect(res.body.organizedEvents.map((e: any) => e.id)).toContain(event.id);
  });

  it('n-expose ni mot de passe ni token de verification', async () => {
    const user = await createUser();

    const res = await api().get('/api/users/me/export').set(authed(user.accessToken));

    expect(res.body.profile).not.toHaveProperty('passwordHash');
    expect(res.body.profile).not.toHaveProperty('emailVerificationToken');
  });
});

describe('Suppression de compte (C-06)', () => {
  it('anonymise le compte et empeche la reconnexion', async () => {
    const user = await createUser();

    const res = await deleteAccount(user.accessToken);
    expect(res.status).toBe(200);

    const login = await api()
      .post('/api/auth/login')
      .send({ email: user.email, password: 'Test1234!' });
    expect(login.status).toBe(401);
  });

  it('invalide le refresh token', async () => {
    const user = await createUser();
    await deleteAccount(user.accessToken);

    const res = await api().post('/api/auth/refresh').send({ refreshToken: user.refreshToken });
    expect(res.status).toBe(401);
  });

  it('libere l-email pour une reinscription', async () => {
    const user = await createUser();
    await deleteAccount(user.accessToken);

    const res = await api()
      .post('/api/auth/register')
      .send({ email: user.email, password: 'Test1234!', acceptTos: true });

    expect(res.status).toBe(201);
  });

  // Le coeur du choix d'anonymisation : les FK sont en ON DELETE CASCADE, donc
  // un vrai DELETE emporterait l-evenement et l-inscription du voisin.
  it('preserve les evenements passes et l-historique des autres joueurs', async () => {
    const organizer = await createUser();
    const player = await createUser();

    const past = await createEvent(organizer.accessToken, {
      dateTime: '2020-01-05T19:00:00.000Z',
    });
    await api().post(`/api/events/${past.id}/join`).set(authed(player.accessToken));

    await deleteAccount(organizer.accessToken);

    const res = await api().get(`/api/events/${past.id}`).set(authed(player.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.participants).toHaveLength(1);
  });

  it('annule les evenements a venir qu-il organisait', async () => {
    const organizer = await createUser();
    const player = await createUser();
    const event = await createEvent(organizer.accessToken);
    await api().post(`/api/events/${event.id}/join`).set(authed(player.accessToken));

    await deleteAccount(organizer.accessToken);

    const res = await api().get(`/api/events/${event.id}`).set(authed(player.accessToken));
    expect(res.body.status).toBe('cancelled');
  });

  it('libere sa place et promeut la liste d-attente', async () => {
    const organizer = await createUser();
    const first = await createUser();
    const second = await createUser();
    const event = await createEvent(organizer.accessToken, { capacity: 1 });

    await api().post(`/api/events/${event.id}/join`).set(authed(first.accessToken));
    await api().post(`/api/events/${event.id}/join`).set(authed(second.accessToken));

    await deleteAccount(first.accessToken);

    const participants = await api()
      .get(`/api/events/${event.id}/participants`)
      .set(authed(organizer.accessToken));

    expect(participants.body.map((p: any) => p.userId)).toEqual([second.id]);
  });

  it('transmet la propriete du groupe au plus ancien admin', async () => {
    const owner = await createUser();
    const member = await createUser();
    const group = await createGroup(owner.accessToken);
    await addMember(owner.accessToken, group.id, member.accessToken);

    await deleteAccount(owner.accessToken);

    const members = await api()
      .get(`/api/groups/${group.id}/members`)
      .set(authed(member.accessToken));

    expect(members.status).toBe(200);
    const successor = members.body.find((m: any) => m.userId === member.id);
    expect(successor.role).toBe('owner');
  });

  it('supprime le groupe dont il etait le seul membre', async () => {
    const owner = await createUser();
    const other = await createUser();
    const group = await createGroup(owner.accessToken, { accessType: 'public' });

    await deleteAccount(owner.accessToken);

    const res = await api().get(`/api/groups/${group.id}`).set(authed(other.accessToken));
    expect(res.status).toBe(404);
  });
});
