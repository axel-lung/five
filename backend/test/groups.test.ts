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

describe('Rejoindre un groupe public (G-06)', () => {
  const join = (token: string, groupId: string) =>
    api().post(`/api/groups/${groupId}/join`).set('Authorization', `Bearer ${token}`);

  it('permet a un inconnu de rejoindre un groupe public', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const group = await createGroup(owner.accessToken, { accessType: 'public' });

    const res = await join(stranger.accessToken, group.id);
    expect(res.status).toBe(201);

    // L'appartenance doit etre reelle, pas seulement annoncee.
    const list = await api()
      .get('/api/groups')
      .set('Authorization', `Bearer ${stranger.accessToken}`);
    expect(list.body.find((g: any) => g.id === group.id).isMember).toBe(true);
  });

  // Un groupe prive ne se rejoint que par invitation. 404 et non 403 : un 403
  // confirmerait son existence a qui n'a pas a la connaitre.
  it('renvoie 404 sur un groupe prive, sans distinguer d-un groupe inexistant', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const group = await createGroup(owner.accessToken, { accessType: 'private' });

    const res = await join(stranger.accessToken, group.id);
    expect(res.status).toBe(404);

    const list = await api()
      .get('/api/groups')
      .set('Authorization', `Bearer ${stranger.accessToken}`);
    expect(list.body.map((g: any) => g.id)).not.toContain(group.id);
  });

  it('est idempotent : rejoindre deux fois ne cree pas de doublon', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const group = await createGroup(owner.accessToken, { accessType: 'public' });

    expect((await join(stranger.accessToken, group.id)).status).toBe(201);
    expect((await join(stranger.accessToken, group.id)).status).toBe(200);

    const members = await api()
      .get(`/api/groups/${group.id}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(members.body.filter((m: any) => m.userId === stranger.id)).toHaveLength(1);
  });

  it('rejoint en simple membre, sans droit d-administration', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const group = await createGroup(owner.accessToken, { accessType: 'public' });

    await join(stranger.accessToken, group.id);

    const res = await api()
      .put(`/api/groups/${group.id}`)
      .set('Authorization', `Bearer ${stranger.accessToken}`)
      .send({ name: 'Detourne', accessType: 'public' });
    expect(res.status).toBe(403);
  });

  // D-06 : meme regle qu'a l'acceptation d'une invitation, le blocage vaut a
  // l'arrivee, et la reponse ne le distingue pas d'un groupe introuvable.
  it('refuse l-arrivee entre comptes bloques', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const group = await createGroup(owner.accessToken, { accessType: 'public' });

    await api()
      .post(`/api/users/${stranger.id}/block`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    const res = await join(stranger.accessToken, group.id);
    expect(res.status).toBe(404);
  });

  it('exige une authentification', async () => {
    const owner = await createUser();
    const group = await createGroup(owner.accessToken, { accessType: 'public' });

    const res = await api().post(`/api/groups/${group.id}/join`);
    expect(res.status).toBe(401);
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

describe('Roles et transmission du groupe (G-03)', () => {
  /** Un groupe, son proprietaire et un membre simple. */
  const groupWithMember = async () => {
    const owner = await createUser();
    const member = await createUser();
    const group = await createGroup(owner.accessToken);
    const invitation = await invite(owner.accessToken, group.id);
    await accept(member.accessToken, invitation.body.token);
    return { owner, member, group };
  };

  const setRole = (token: string, groupId: string, userId: string, role: string) =>
    api()
      .patch(`/api/groups/${groupId}/members/${userId}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role });

  const transfer = (token: string, groupId: string, newOwnerId: string) =>
    api()
      .post(`/api/groups/${groupId}/transfer-ownership`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newOwnerId });

  it('promeut un membre admin', async () => {
    const { owner, member, group } = await groupWithMember();

    const res = await setRole(owner.accessToken, group.id, member.id, 'admin');

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
  });

  it('interdit a un membre de se promouvoir', async () => {
    const { member, group } = await groupWithMember();

    const res = await setRole(member.accessToken, group.id, member.id, 'admin');

    expect(res.status).toBe(403);
  });

  it('refuse d-attribuer le role owner par cette route', async () => {
    const { owner, member, group } = await groupWithMember();

    const res = await setRole(owner.accessToken, group.id, member.id, 'owner');

    expect(res.status).toBe(400);
  });

  it('transmet la propriete et retrograde l-ancien proprietaire en admin', async () => {
    const { owner, member, group } = await groupWithMember();

    const res = await transfer(owner.accessToken, group.id, member.id);
    expect(res.status).toBe(200);

    const members = await api()
      .get(`/api/groups/${group.id}/members`)
      .set('Authorization', `Bearer ${member.accessToken}`);

    const roles = Object.fromEntries(members.body.map((m: any) => [m.userId, m.role]));
    expect(roles[member.id]).toBe('owner');
    expect(roles[owner.id]).toBe('admin');
  });

  // Le cul-de-sac que ce lot corrige : leaveGroup exigeait une transmission
  // qu-aucune route ne permettait.
  it('permet enfin a l-ancien proprietaire de quitter le groupe', async () => {
    const { owner, member, group } = await groupWithMember();

    const before = await api()
      .post(`/api/groups/${group.id}/leave`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(before.status).toBe(400);

    await transfer(owner.accessToken, group.id, member.id);

    const after = await api()
      .post(`/api/groups/${group.id}/leave`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(after.status).toBe(200);
  });

  it('refuse de transmettre a un non-membre', async () => {
    const { owner, group } = await groupWithMember();
    const stranger = await createUser();

    const res = await transfer(owner.accessToken, group.id, stranger.id);

    expect(res.status).toBe(404);
  });

  it('interdit a un tiers de transmettre le groupe', async () => {
    const { member, group } = await groupWithMember();

    const res = await transfer(member.accessToken, group.id, member.id);

    expect(res.status).toBe(403);
  });
});

describe('Avatar de groupe (G-01)', () => {
  it('accepte un avatar a la creation', async () => {
    const owner = await createUser();

    const group = await createGroup(owner.accessToken, {
      avatarUrl: 'https://example.com/logo.png',
    });

    expect(group.avatarUrl).toBe('https://example.com/logo.png');
  });
});
