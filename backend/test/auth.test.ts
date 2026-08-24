import { api, createUser } from './helpers';

describe('Authentification', () => {
  it('inscrit un utilisateur et renvoie les deux tokens', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ email: 'alice@example.com', password: 'Test1234!', firstName: 'Alice' });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('refuse une adresse deja utilisee', async () => {
    const user = await createUser();
    const res = await api()
      .post('/api/auth/register')
      .send({ email: user.email, password: 'Test1234!' });

    expect(res.status).toBe(409);
  });

  it('refuse un mot de passe errone', async () => {
    const user = await createUser();
    const res = await api()
      .post('/api/auth/login')
      .send({ email: user.email, password: 'MauvaisMotDePasse!' });

    expect(res.status).toBe(401);
  });

  describe('Protection des routes', () => {
    it('rejette une requete sans token', async () => {
      const res = await api().get('/api/users/profile');
      expect(res.status).toBe(401);
    });

    // Regression : userRoutes n'appliquait pas authenticateToken, le
    // controleur lisait req.user.id sur undefined et renvoyait 500.
    it('renvoie le profil avec un token valide', async () => {
      const user = await createUser();
      const res = await api()
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(user.id);
      expect(res.body.passwordHash).toBeUndefined();
    });
  });

  describe('Refresh token', () => {
    it('echange un refresh token contre un nouvel access token', async () => {
      const user = await createUser();
      const res = await api()
        .post('/api/auth/refresh')
        .send({ refreshToken: user.refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toEqual(expect.any(String));

      const profile = await api()
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${res.body.accessToken}`);
      expect(profile.status).toBe(200);
    });

    // Le coeur de la revendication `type` : un refresh token vaut 30 jours.
    // S'il etait accepte comme token d'acces, il vaudrait session permanente.
    it("refuse un refresh token la ou un access token est attendu", async () => {
      const user = await createUser();
      const res = await api()
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${user.refreshToken}`);

      expect(res.status).toBe(401);
    });

    it("refuse un access token la ou un refresh token est attendu", async () => {
      const user = await createUser();
      const res = await api()
        .post('/api/auth/refresh')
        .send({ refreshToken: user.accessToken });

      expect(res.status).toBe(401);
    });

    it('refuse un refresh token invalide', async () => {
      const res = await api().post('/api/auth/refresh').send({ refreshToken: 'nimporte.quoi' });
      expect(res.status).toBe(401);
    });
  });
});
