import { api, createUser, createEvent } from './helpers';
import { PushTokenModel as PushToken } from '../src/models';

const authed = (token: string) => ({ Authorization: `Bearer ${token}` });

const register = (token: string, body: Record<string, unknown>) =>
  api().post('/api/users/me/push-tokens').set(authed(token)).send(body);

const device = (overrides: Record<string, unknown> = {}) => ({
  token: `ExponentPushToken[${Math.random().toString(36).slice(2)}]`,
  platform: 'android',
  timezone: 'Europe/Paris',
  ...overrides,
});

describe('Enregistrement des appareils (N-01)', () => {
  it('enregistre un appareil', async () => {
    const user = await createUser();

    const res = await register(user.accessToken, device());

    expect(res.status).toBe(201);
    expect(await PushToken.count({ where: { userId: user.id } })).toBe(1);
  });

  it('accepte plusieurs appareils pour un meme compte', async () => {
    const user = await createUser();

    await register(user.accessToken, device());
    await register(user.accessToken, device());

    expect(await PushToken.count({ where: { userId: user.id } })).toBe(2);
  });

  // Un telephone revendu ne doit pas continuer d'alerter l'ancien
  // proprietaire : le jeton change de mains plutot que d'etre refuse.
  it('transfere un jeton deja connu au nouveau compte', async () => {
    const first = await createUser();
    const second = await createUser();
    const shared = device();

    await register(first.accessToken, shared);
    const res = await register(second.accessToken, shared);

    expect(res.status).toBe(200);
    expect(await PushToken.count({ where: { userId: first.id } })).toBe(0);
    expect(await PushToken.count({ where: { userId: second.id } })).toBe(1);
  });

  it('refuse une plateforme inconnue', async () => {
    const user = await createUser();

    const res = await register(user.accessToken, device({ platform: 'blackberry' }));

    expect(res.status).toBe(400);
  });

  it('exige une authentification', async () => {
    const res = await api().post('/api/users/me/push-tokens').send(device());
    expect(res.status).toBe(401);
  });

  it('retire un appareil a la deconnexion', async () => {
    const user = await createUser();
    const mine = device();
    await register(user.accessToken, mine);

    const res = await api()
      .delete(`/api/users/me/push-tokens/${encodeURIComponent(mine.token as string)}`)
      .set(authed(user.accessToken));

    expect(res.status).toBe(200);
    expect(await PushToken.count({ where: { userId: user.id } })).toBe(0);
  });

  // Un compte ne doit pas pouvoir desinscrire l'appareil d'un autre en
  // devinant son jeton.
  it('ne retire pas l-appareil d-un autre compte', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const mine = device();
    await register(owner.accessToken, mine);

    const res = await api()
      .delete(`/api/users/me/push-tokens/${encodeURIComponent(mine.token as string)}`)
      .set(authed(stranger.accessToken));

    expect(res.status).toBe(404);
    expect(await PushToken.count({ where: { userId: owner.id } })).toBe(1);
  });

  it('efface les appareils avec le compte', async () => {
    const user = await createUser();
    await register(user.accessToken, device());

    await api().delete('/api/users/me').set(authed(user.accessToken));

    expect(await PushToken.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe('Heures de silence et push (N-04)', () => {
  /**
   * Le service d'envoi est muet en test : on ne verifie pas qu'un push part
   * — ce serait tester Expo — mais que la notification, elle, est bien ecrite
   * quelles que soient les preferences. Le silence supprime le push, jamais
   * la notification.
   */
  it('ecrit la notification meme quand le push est desactive', async () => {
    const organizer = await createUser();
    const player = await createUser();
    const event = await createEvent(organizer.accessToken);

    await register(player.accessToken, device());
    await api()
      .put('/api/notifications/preferences')
      .set(authed(player.accessToken))
      .send({ pushEnabled: false });

    await api().post(`/api/events/${event.id}/join`).set(authed(player.accessToken));
    await api()
      .patch(`/api/events/${event.id}/status`)
      .set(authed(organizer.accessToken))
      .send({ status: 'cancelled' });

    const inbox = await api().get('/api/notifications').set(authed(player.accessToken));
    expect(inbox.body.notifications.map((n: any) => n.type)).toContain('event.cancelled');
  });

  it('ecrit la notification pendant les heures de silence', async () => {
    const organizer = await createUser();
    const player = await createUser();
    const event = await createEvent(organizer.accessToken);

    await register(player.accessToken, device());
    await api()
      .put('/api/notifications/preferences')
      .set(authed(player.accessToken))
      // Plage couvrant toute la journee, pour ne pas dependre de l'heure
      // a laquelle la suite tourne.
      .send({ quietHoursStart: 0, quietHoursEnd: 23 });

    await api().post(`/api/events/${event.id}/join`).set(authed(player.accessToken));
    await api()
      .patch(`/api/events/${event.id}/status`)
      .set(authed(organizer.accessToken))
      .send({ status: 'cancelled' });

    const inbox = await api().get('/api/notifications').set(authed(player.accessToken));
    expect(inbox.body.notifications.map((n: any) => n.type)).toContain('event.cancelled');
  });
});
