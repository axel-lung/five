import { api, createUser, createGroup } from './helpers';
import { UserModel as User } from '../src/models';

const authed = (token: string) => ({ Authorization: `Bearer ${token}` });

const invite = (token: string, groupId: string) =>
  api().post(`/api/groups/${groupId}/invitations`).set(authed(token)).send({});

const accept = (token: string, inviteToken: string) =>
  api().post(`/api/groups/invitations/${inviteToken}/accept`).set(authed(token));

describe('Profil public (D-02)', () => {
  it('renvoie le profil minimal d-un autre joueur', async () => {
    const me = await createUser();
    const other = await createUser({ firstName: 'Yanis', city: 'Reims' });

    const res = await api().get(`/api/users/${other.id}`).set(authed(me.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe('Yanis');
    expect(res.body.city).toBe('Reims');
  });

  it('n-expose ni email ni telephone', async () => {
    const me = await createUser();
    const other = await createUser({ phone: '0600000000' });

    const res = await api().get(`/api/users/${other.id}`).set(authed(me.accessToken));

    expect(res.body).not.toHaveProperty('email');
    expect(res.body).not.toHaveProperty('phone');
  });

  // Les disponibilites servent la recommandation locale (D-04, V2) et n-ont
  // pas a etre publiques avant.
  it('n-expose pas les disponibilites', async () => {
    const me = await createUser();
    const other = await createUser();
    await api()
      .put('/api/users/profile')
      .set(authed(other.accessToken))
      .send({ preferredSlots: ['mardi-soir'], travelRadiusKm: 15 });

    const res = await api().get(`/api/users/${other.id}`).set(authed(me.accessToken));

    expect(res.body).not.toHaveProperty('preferredSlots');
    expect(res.body).not.toHaveProperty('travelRadiusKm');
  });

  it('rend le profil invisible apres un blocage', async () => {
    const me = await createUser();
    const other = await createUser();
    await api().post(`/api/users/${other.id}/block`).set(authed(me.accessToken));

    const res = await api().get(`/api/users/${other.id}`).set(authed(me.accessToken));

    expect(res.status).toBe(404);
  });

  it('cache aussi le profil de celui qui vous a bloque', async () => {
    const me = await createUser();
    const other = await createUser();
    await api().post(`/api/users/${me.id}/block`).set(authed(other.accessToken));

    const res = await api().get(`/api/users/${other.id}`).set(authed(me.accessToken));

    expect(res.status).toBe(404);
  });

  it('renvoie 404 pour un compte suspendu', async () => {
    const me = await createUser();
    const other = await createUser();
    await User.update({ suspendedAt: new Date() } as any, { where: { id: other.id } });

    const res = await api().get(`/api/users/${other.id}`).set(authed(me.accessToken));

    expect(res.status).toBe(404);
  });

  // '/:id' ne doit pas avaler les routes declarees avant lui.
  it('ne capture pas /profile ni /me/export', async () => {
    const me = await createUser();

    expect((await api().get('/api/users/profile').set(authed(me.accessToken))).status).toBe(200);
    expect((await api().get('/api/users/me/export').set(authed(me.accessToken))).status).toBe(200);
  });
});

describe('Disponibilites (C-03)', () => {
  it('enregistre creneaux et rayon de deplacement', async () => {
    const user = await createUser();

    const res = await api()
      .put('/api/users/profile')
      .set(authed(user.accessToken))
      .send({ preferredSlots: ['mardi-soir', 'jeudi-soir'], travelRadiusKm: 20 });

    expect(res.status).toBe(200);
    expect(res.body.preferredSlots).toEqual(['mardi-soir', 'jeudi-soir']);
    expect(res.body.travelRadiusKm).toBe(20);
  });

  it('vaut une liste vide par defaut', async () => {
    const user = await createUser();

    const res = await api().get('/api/users/profile').set(authed(user.accessToken));

    expect(res.body.preferredSlots).toEqual([]);
  });

  it('refuse un rayon hors bornes', async () => {
    const user = await createUser();

    const res = await api()
      .put('/api/users/profile')
      .set(authed(user.accessToken))
      .send({ travelRadiusKm: 500 });

    expect(res.status).toBe(400);
  });
});

describe('Recherche dans les membres (G-05)', () => {
  const groupWithMembers = async () => {
    const owner = await createUser({ firstName: 'Sebastien' });
    const lucas = await createUser({ firstName: 'Lucas' });
    const iacob = await createUser({ firstName: 'Iacob' });
    const group = await createGroup(owner.accessToken);

    for (const member of [lucas, iacob]) {
      const invitation = await invite(owner.accessToken, group.id);
      await accept(member.accessToken, invitation.body.token);
    }

    return { owner, lucas, iacob, group };
  };

  it('filtre les membres par prenom', async () => {
    const { owner, lucas, group } = await groupWithMembers();

    const res = await api()
      .get(`/api/groups/${group.id}/members?q=luc`)
      .set(authed(owner.accessToken));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].userId).toBe(lucas.id);
  });

  it('renvoie tous les membres sans filtre', async () => {
    const { owner, group } = await groupWithMembers();

    const res = await api()
      .get(`/api/groups/${group.id}/members`)
      .set(authed(owner.accessToken));

    expect(res.body).toHaveLength(3);
  });

  it('renvoie une liste vide quand rien ne correspond', async () => {
    const { owner, group } = await groupWithMembers();

    const res = await api()
      .get(`/api/groups/${group.id}/members?q=zzzz`)
      .set(authed(owner.accessToken));

    expect(res.body).toHaveLength(0);
  });
});
