import { api, createUser } from './helpers';
import { UserModel as User } from '../src/models';

const authed = (token: string) => ({ Authorization: `Bearer ${token}` });

const createAdmin = async () => {
  const admin = await createUser();
  await User.update({ role: 'admin' } as any, { where: { id: admin.id } });
  return admin;
};

const declare = (token: string, body: Record<string, unknown> = {}) =>
  api()
    .post('/api/bug-reports')
    .set(authed(token))
    .send({
      description: "Le bouton « Je participe » ne repond pas sur la fiche session.",
      context: { url: '/sessions/abc', userAgent: 'Firefox/128', viewport: '390x844' },
      ...body,
    });

describe('Declaration d-anomalie (beta)', () => {
  it('enregistre une anomalie avec son contexte', async () => {
    const tester = await createUser();

    const res = await declare(tester.accessToken, { severity: 'blocking' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('open');
  });

  it('exige une description exploitable', async () => {
    const tester = await createUser();

    const res = await declare(tester.accessToken, { description: 'bug' });

    expect(res.status).toBe(400);
  });

  // Le contexte est rempli par le client : il ne doit pas pouvoir servir de
  // depot libre dans le JSONB.
  it('refuse une cle de contexte inconnue', async () => {
    const tester = await createUser();

    const res = await declare(tester.accessToken, {
      context: { url: '/dashboard', payload: 'x'.repeat(50) },
    });

    expect(res.status).toBe(400);
  });

  it('refuse un anonyme', async () => {
    const res = await api().post('/api/bug-reports').send({ description: 'Ecran blanc au demarrage.' });

    expect(res.status).toBe(401);
  });

  it('laisse le testeur suivre ses propres declarations, sans le contexte interne', async () => {
    const tester = await createUser();
    const other = await createUser();
    await declare(tester.accessToken);
    await declare(other.accessToken);

    const res = await api().get('/api/bug-reports/mine').set(authed(tester.accessToken));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].context).toBeUndefined();
    expect(res.body[0].status).toBe('open');
  });

  it('interdit la file complete a un joueur', async () => {
    const tester = await createUser();

    const res = await api().get('/api/admin/bug-reports').set(authed(tester.accessToken));

    expect(res.status).toBe(404);
  });

  it('presente les anomalies les plus graves en premier', async () => {
    const admin = await createAdmin();
    const tester = await createUser();

    await declare(tester.accessToken, { severity: 'minor', description: 'Marge trop large en bas.' });
    await declare(tester.accessToken, { severity: 'blocking', description: 'Impossible de se connecter.' });
    await declare(tester.accessToken, { severity: 'major', description: 'La date affichee est decalee.' });

    const res = await api().get('/api/admin/bug-reports').set(authed(admin.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.map((r: any) => r.severity)).toEqual(['blocking', 'major', 'minor']);
    expect(res.body[0].reporter.email).toBe(tester.email);
    expect(res.body[0].context.viewport).toBe('390x844');
  });

  it('traite une anomalie, la sort de la file et journalise la decision', async () => {
    const admin = await createAdmin();
    const tester = await createUser();
    const created = await declare(tester.accessToken);

    const res = await api()
      .patch(`/api/admin/bug-reports/${created.body.id}`)
      .set(authed(admin.accessToken))
      .send({ status: 'fixed', resolutionNote: 'Corrige en 1.0.1.' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('fixed');

    const open = await api().get('/api/admin/bug-reports?status=open').set(authed(admin.accessToken));
    expect(open.body).toHaveLength(0);

    const fixed = await api().get('/api/admin/bug-reports?status=fixed').set(authed(admin.accessToken));
    expect(fixed.body[0].resolutionNote).toBe('Corrige en 1.0.1.');
    expect(fixed.body[0].handledBy).toBe(admin.id);

    const logs = await api()
      .get('/api/admin/audit-logs?action=admin.bugReport.update')
      .set(authed(admin.accessToken));
    expect(logs.body).toHaveLength(1);
    expect(logs.body[0].metadata.status).toBe('fixed');
  });

  it('remonte le compteur d-anomalies ouvertes sur le tableau de bord', async () => {
    const admin = await createAdmin();
    const tester = await createUser();
    await declare(tester.accessToken);

    const res = await api().get('/api/admin/stats').set(authed(admin.accessToken));

    expect(res.body.openBugReports).toBe(1);
  });
});
