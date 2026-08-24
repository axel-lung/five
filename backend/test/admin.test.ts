import { api, createUser, createEvent, createGroup } from './helpers';
import { UserModel as User } from '../src/models';

const authed = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Promeut un compte administrateur en base, comme le fait npm run make-admin. */
const createAdmin = async () => {
  const admin = await createUser();
  await User.update({ role: 'admin' } as any, { where: { id: admin.id } });
  return admin;
};

const report = (token: string, targetId: string) =>
  api()
    .post('/api/reports')
    .set(authed(token))
    .send({ targetType: 'user', targetId, reason: 'spam' });

describe('Acces au back-office (B-01)', () => {
  // 404 et non 403 : l'existence d'un back-office ne regarde pas les comptes
  // ordinaires.
  it('renvoie 404 a un compte ordinaire', async () => {
    const user = await createUser();

    const res = await api().get('/api/admin/stats').set(authed(user.accessToken));

    expect(res.status).toBe(404);
  });

  it('exige une authentification', async () => {
    const res = await api().get('/api/admin/stats');
    expect(res.status).toBe(401);
  });

  it('ouvre le tableau de bord a un administrateur', async () => {
    const admin = await createAdmin();
    const player = await createUser();
    const group = await createGroup(player.accessToken);
    await createEvent(player.accessToken, { groupId: group.id });

    const res = await api().get('/api/admin/stats').set(authed(admin.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.users.total).toBeGreaterThanOrEqual(2);
    expect(res.body.groups).toBe(1);
    expect(res.body.events.upcoming).toBe(1);
  });

  // Le role est relu en base a chaque appel : une revocation prend effet tout
  // de suite, sans attendre l'expiration du token.
  it('ferme l-acces des la revocation du role, sans nouveau token', async () => {
    const admin = await createAdmin();
    expect((await api().get('/api/admin/stats').set(authed(admin.accessToken))).status).toBe(200);

    await User.update({ role: 'user' } as any, { where: { id: admin.id } });

    expect((await api().get('/api/admin/stats').set(authed(admin.accessToken))).status).toBe(404);
  });
});

describe('Support (B-03)', () => {
  it('recherche un compte par email', async () => {
    const admin = await createAdmin();
    const player = await createUser();

    const res = await api()
      .get(`/api/admin/users?q=${encodeURIComponent(player.email)}`)
      .set(authed(admin.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.map((u: any) => u.id)).toContain(player.id);
  });

  it('refuse une recherche trop courte', async () => {
    const admin = await createAdmin();

    const res = await api().get('/api/admin/users?q=a').set(authed(admin.accessToken));

    expect(res.status).toBe(400);
  });

  it('journalise la consultation d-un dossier', async () => {
    const admin = await createAdmin();
    const player = await createUser();

    await api().get(`/api/admin/users/${player.id}`).set(authed(admin.accessToken));

    const logs = await api()
      .get(`/api/admin/audit-logs?targetId=${player.id}`)
      .set(authed(admin.accessToken));

    expect(logs.body.map((l: any) => l.action)).toContain('admin.user.view');
  });
});

describe('Moderation (B-02)', () => {
  it('suspend un compte et lui interdit la connexion', async () => {
    const admin = await createAdmin();
    const player = await createUser();

    const res = await api()
      .post(`/api/admin/users/${player.id}/suspend`)
      .set(authed(admin.accessToken))
      .send({ reason: 'comportement abusif' });
    expect(res.status).toBe(200);

    const login = await api()
      .post('/api/auth/login')
      .send({ email: player.email, password: 'Test1234!' });

    expect(login.status).toBe(403);
    expect(login.body.reason).toBe('comportement abusif');
  });

  it('invalide aussi le refresh token d-un compte suspendu', async () => {
    const admin = await createAdmin();
    const player = await createUser();

    await api()
      .post(`/api/admin/users/${player.id}/suspend`)
      .set(authed(admin.accessToken))
      .send({ reason: 'spam' });

    const res = await api().post('/api/auth/refresh').send({ refreshToken: player.refreshToken });
    expect(res.status).toBe(401);
  });

  it('leve une suspension', async () => {
    const admin = await createAdmin();
    const player = await createUser();

    await api()
      .post(`/api/admin/users/${player.id}/suspend`)
      .set(authed(admin.accessToken))
      .send({ reason: 'spam' });
    await api()
      .post(`/api/admin/users/${player.id}/unsuspend`)
      .set(authed(admin.accessToken));

    const login = await api()
      .post('/api/auth/login')
      .send({ email: player.email, password: 'Test1234!' });

    expect(login.status).toBe(200);
  });

  it('empeche un administrateur de se suspendre lui-meme', async () => {
    const admin = await createAdmin();

    const res = await api()
      .post(`/api/admin/users/${admin.id}/suspend`)
      .set(authed(admin.accessToken))
      .send({ reason: 'test' });

    expect(res.status).toBe(400);
  });

  it('exige un motif de suspension', async () => {
    const admin = await createAdmin();
    const player = await createUser();

    const res = await api()
      .post(`/api/admin/users/${player.id}/suspend`)
      .set(authed(admin.accessToken))
      .send({});

    expect(res.status).toBe(400);
  });

  it('traite un signalement et en garde le traitant', async () => {
    const admin = await createAdmin();
    const reporter = await createUser();
    const target = await createUser();
    const created = await report(reporter.accessToken, target.id);

    const res = await api()
      .patch(`/api/admin/reports/${created.body.id}`)
      .set(authed(admin.accessToken))
      .send({ status: 'resolved', resolutionNote: 'compte suspendu' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('resolved');

    const queue = await api()
      .get('/api/admin/reports?status=open')
      .set(authed(admin.accessToken));
    expect(queue.body).toHaveLength(0);
  });

  it('liste les signalements ouverts', async () => {
    const admin = await createAdmin();
    const reporter = await createUser();
    const target = await createUser();
    await report(reporter.accessToken, target.id);

    const res = await api().get('/api/admin/reports').set(authed(admin.accessToken));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe('open');
  });
});

describe('Journal d-audit (B-06)', () => {
  it('trace une suspension avec son motif et son auteur', async () => {
    const admin = await createAdmin();
    const player = await createUser();

    await api()
      .post(`/api/admin/users/${player.id}/suspend`)
      .set(authed(admin.accessToken))
      .send({ reason: 'triche' });

    const res = await api()
      .get('/api/admin/audit-logs?action=admin.user.suspend')
      .set(authed(admin.accessToken));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].actorId).toBe(admin.id);
    expect(res.body[0].targetId).toBe(player.id);
    expect(res.body[0].metadata.reason).toBe('triche');
  });

  it('n-est pas consultable par un compte ordinaire', async () => {
    const user = await createUser();

    const res = await api().get('/api/admin/audit-logs').set(authed(user.accessToken));

    expect(res.status).toBe(404);
  });
});
