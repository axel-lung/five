import { api, createUser, createGroup } from './helpers';

const authed = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Un PNG 1x1 valide, assez reel pour traverser multer. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const uploadAvatar = (token: string, buffer: Buffer, filename: string, contentType: string) =>
  api()
    .post('/api/users/avatar')
    .set(authed(token))
    .attach('avatar', buffer, { filename, contentType });

describe('Avatar du joueur (C-02)', () => {
  it('televerse un avatar et le rattache au profil', async () => {
    const user = await createUser();

    const res = await uploadAvatar(user.accessToken, PNG, 'moi.png', 'image/png');

    expect(res.status).toBe(201);
    expect(res.body.avatarUrl).toMatch(/^\/api\/media\/[0-9a-f-]{36}\.png$/);

    const profile = await api().get('/api/users/profile').set(authed(user.accessToken));
    expect(profile.body.avatarUrl).toBe(res.body.avatarUrl);
  });

  it('ressert l-image sans authentification', async () => {
    const user = await createUser();
    const upload = await uploadAvatar(user.accessToken, PNG, 'moi.png', 'image/png');

    const res = await api().get(upload.body.avatarUrl);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.body).toEqual(PNG);
  });

  it('refuse un type non image', async () => {
    const user = await createUser();

    const res = await uploadAvatar(
      user.accessToken,
      Buffer.from('#!/bin/sh\nrm -rf /'),
      'payload.sh',
      'application/x-sh'
    );

    expect(res.status).toBe(400);
  });

  it('refuse une image trop lourde', async () => {
    const user = await createUser();

    const res = await uploadAvatar(
      user.accessToken,
      Buffer.alloc(3 * 1024 * 1024, 1),
      'gros.png',
      'image/png'
    );

    expect(res.status).toBe(400);
  });

  it('refuse une requete sans fichier', async () => {
    const user = await createUser();

    const res = await api().post('/api/users/avatar').set(authed(user.accessToken));

    expect(res.status).toBe(400);
  });

  it('exige une authentification', async () => {
    const res = await api()
      .post('/api/users/avatar')
      .attach('avatar', PNG, { filename: 'moi.png', contentType: 'image/png' });

    expect(res.status).toBe(401);
  });

  // Le nom fourni par le client n-est jamais repris : l-extension vient du
  // mimetype valide, pas du fichier.
  it('ignore le nom d-origine et impose sa propre extension', async () => {
    const user = await createUser();

    const res = await uploadAvatar(user.accessToken, PNG, '../../etc/passwd', 'image/png');

    expect(res.status).toBe(201);
    expect(res.body.avatarUrl).toMatch(/^\/api\/media\/[0-9a-f-]{36}\.png$/);
  });

  it('refuse une cle de media malformee', async () => {
    const res = await api().get('/api/media/..%2F..%2Fetc%2Fpasswd');
    expect(res.status).toBe(404);
  });

  it('renvoie 404 pour une cle inconnue', async () => {
    const res = await api().get('/api/media/11111111-1111-1111-1111-111111111111.png');
    expect(res.status).toBe(404);
  });
});

describe('Avatar du groupe (G-01)', () => {
  const uploadGroup = (token: string, groupId: string) =>
    api()
      .post(`/api/groups/${groupId}/avatar`)
      .set(authed(token))
      .attach('avatar', PNG, { filename: 'logo.png', contentType: 'image/png' });

  it('televerse l-avatar du groupe', async () => {
    const owner = await createUser();
    const group = await createGroup(owner.accessToken);

    const res = await uploadGroup(owner.accessToken, group.id);

    expect(res.status).toBe(201);

    const detail = await api()
      .get(`/api/groups/${group.id}`)
      .set(authed(owner.accessToken));
    expect(detail.body.avatarUrl).toBe(res.body.avatarUrl);
  });

  it('interdit a un tiers de changer l-avatar', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const group = await createGroup(owner.accessToken, { accessType: 'public' });

    const res = await uploadGroup(stranger.accessToken, group.id);

    expect(res.status).toBe(403);
  });
});
