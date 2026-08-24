import { api, createUser, createGroup } from './helpers';

const invite = (token: string, groupId: string, body: Record<string, unknown> = {}) =>
  api()
    .post(`/api/groups/${groupId}/invitations`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);

const accept = (token: string, inviteToken: string) =>
  api()
    .post(`/api/groups/invitations/${inviteToken}/accept`)
    .set('Authorization', `Bearer ${token}`);

describe('Creation de groupe', () => {
  // Regression majeure : Group.create ne peuplait pas group_members, donc le
  // createur n-etait pas membre de son groupe et recevait 403 sur toute
  // action d-administration.
  it('inscrit le createur comme membre proprietaire', async () => {
    const owner = await createUser();
    const group = await createGroup(owner.accessToken);

    const res = await api()
      .get(`/api/groups/${group.id}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].userId).toBe(owner.id);
    expect(res.body[0].role).toBe('owner');
  });

  it('autorise le proprietaire a inviter juste apres creation', async () => {
    const owner = await createUser();
    const group = await createGroup(owner.accessToken);

    const res = await invite(owner.accessToken, group.id);
    expect(res.status).toBe(201);
  });
});

describe('Invitations (G-02)', () => {
  it('expose un apercu public sans compte', async () => {
    const owner = await createUser();
    const group = await createGroup(owner.accessToken, { name: 'Futsal Reims' });
    const invitation = await invite(owner.accessToken, group.id);

    const res = await api().get(`/api/groups/invitations/${invitation.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.group.name).toBe('Futsal Reims');
    expect(res.body.memberCount).toBe(1);
  });

  it('ne divulgue pas les membres dans l-apercu', async () => {
    const owner = await createUser();
    const group = await createGroup(owner.accessToken);
    const invitation = await invite(owner.accessToken, group.id);

    const res = await api().get(`/api/groups/invitations/${invitation.body.token}`);

    expect(JSON.stringify(res.body)).not.toContain(owner.email);
    expect(res.body.members).toBeUndefined();
  });

  it('fait rejoindre le groupe', async () => {
    const owner = await createUser();
    const guest = await createUser();
    const group = await createGroup(owner.accessToken);
    const invitation = await invite(owner.accessToken, group.id);

    const res = await accept(guest.accessToken, invitation.body.token);

    expect(res.status).toBe(201);
    expect(res.body.groupId).toBe(group.id);

    const members = await api()
      .get(`/api/groups/${group.id}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(members.body).toHaveLength(2);
  });

  // Recliquer sur un lien WhatsApp est le cas nominal, pas une erreur.
  it('est idempotente et ne consomme pas deux utilisations', async () => {
    const owner = await createUser();
    const guest = await createUser();
    const group = await createGroup(owner.accessToken);
    const invitation = await invite(owner.accessToken, group.id, { maxUses: 1 });

    const first = await accept(guest.accessToken, invitation.body.token);
    const second = await accept(guest.accessToken, invitation.body.token);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);

    const list = await api()
      .get(`/api/groups/${group.id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(list.body[0].uses).toBe(1);
  });

  it('refuse au-dela de maxUses', async () => {
    const owner = await createUser();
    const first = await createUser();
    const second = await createUser();
    const group = await createGroup(owner.accessToken);
    const invitation = await invite(owner.accessToken, group.id, { maxUses: 1 });

    await accept(first.accessToken, invitation.body.token);
    const res = await accept(second.accessToken, invitation.body.token);

    expect(res.status).toBe(404);
  });

  it('refuse une invitation revoquee', async () => {
    const owner = await createUser();
    const guest = await createUser();
    const group = await createGroup(owner.accessToken);
    const invitation = await invite(owner.accessToken, group.id);

    await api()
      .delete(`/api/groups/invitations/${invitation.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    const res = await accept(guest.accessToken, invitation.body.token);
    expect(res.status).toBe(404);

    const preview = await api().get(`/api/groups/invitations/${invitation.body.token}`);
    expect(preview.status).toBe(404);
  });

  it('interdit a un simple membre d-inviter', async () => {
    const owner = await createUser();
    const member = await createUser();
    const group = await createGroup(owner.accessToken);
    const invitation = await invite(owner.accessToken, group.id);
    await accept(member.accessToken, invitation.body.token);

    const res = await invite(member.accessToken, group.id);
    expect(res.status).toBe(403);
  });

  it('donne le role admin quand l-invitation le prevoit', async () => {
    const owner = await createUser();
    const guest = await createUser();
    const group = await createGroup(owner.accessToken);
    const invitation = await invite(owner.accessToken, group.id, { role: 'admin' });

    await accept(guest.accessToken, invitation.body.token);

    // Un admin doit pouvoir inviter a son tour.
    const res = await invite(guest.accessToken, group.id);
    expect(res.status).toBe(201);
  });
});

describe('Visibilite des groupes (G-06 / C-04)', () => {
  // Regression : getGroups renvoyait tous les groupes, prives compris, avec la
  // liste complete des membres et leurs emails.
  it('ne liste pas les groupes prives dont on n-est pas membre', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const group = await createGroup(owner.accessToken, { accessType: 'private' });

    const res = await api()
      .get('/api/groups')
      .set('Authorization', `Bearer ${stranger.accessToken}`);

    expect(res.body.map((g: any) => g.id)).not.toContain(group.id);
  });

  it('liste les groupes publics et ceux dont on est membre', async () => {
    const owner = await createUser();
    const other = await createUser();
    const publicGroup = await createGroup(owner.accessToken, { accessType: 'public' });
    const ownGroup = await createGroup(other.accessToken, { accessType: 'private' });

    const res = await api()
      .get('/api/groups')
      .set('Authorization', `Bearer ${other.accessToken}`);

    const ids = res.body.map((g: any) => g.id);
    expect(ids).toContain(publicGroup.id);
    expect(ids).toContain(ownGroup.id);
  });

  it('renvoie 404 sur le detail d-un groupe prive tiers', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const group = await createGroup(owner.accessToken, { accessType: 'private' });

    const res = await api()
      .get(`/api/groups/${group.id}`)
      .set('Authorization', `Bearer ${stranger.accessToken}`);

    expect(res.status).toBe(404);
  });

  it('n-expose jamais les emails des membres', async () => {
    const owner = await createUser();
    const guest = await createUser();
    const group = await createGroup(owner.accessToken);
    const invitation = await invite(owner.accessToken, group.id);
    await accept(guest.accessToken, invitation.body.token);

    const detail = await api()
      .get(`/api/groups/${group.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    const members = await api()
      .get(`/api/groups/${group.id}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    // Sans ces deux assertions de statut, un 500 satisferait le test :
    // le corps d-erreur ne contient evidemment aucun email.
    expect(detail.status).toBe(200);
    expect(members.status).toBe(200);

    expect(JSON.stringify(detail.body)).not.toContain(guest.email);
    expect(JSON.stringify(members.body)).not.toContain(guest.email);
  });
});

describe('Quitter un groupe (G-04)', () => {
  it('permet a un membre de partir', async () => {
    const owner = await createUser();
    const guest = await createUser();
    const group = await createGroup(owner.accessToken);
    const invitation = await invite(owner.accessToken, group.id);
    await accept(guest.accessToken, invitation.body.token);

    const res = await api()
      .post(`/api/groups/${group.id}/leave`)
      .set('Authorization', `Bearer ${guest.accessToken}`);

    expect(res.status).toBe(200);

    const members = await api()
      .get(`/api/groups/${group.id}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(members.body).toHaveLength(1);
  });

  // Sinon le groupe resterait sans proprietaire, donc inadministrable.
  it('empeche le proprietaire de partir', async () => {
    const owner = await createUser();
    const group = await createGroup(owner.accessToken);

    const res = await api()
      .post(`/api/groups/${group.id}/leave`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(res.status).toBe(400);
  });

  it('refuse de faire partir un non-membre', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const group = await createGroup(owner.accessToken);

    const res = await api()
      .post(`/api/groups/${group.id}/leave`)
      .set('Authorization', `Bearer ${stranger.accessToken}`);

    expect(res.status).toBe(404);
  });
});
