import { api, createUser, createEvent } from './helpers';

const join = (token: string, eventId: string) =>
  api().post(`/api/events/${eventId}/join`).set('Authorization', `Bearer ${token}`);

const leave = (token: string, eventId: string) =>
  api().post(`/api/events/${eventId}/leave`).set('Authorization', `Bearer ${token}`);

const getEvent = (token: string, eventId: string) =>
  api().get(`/api/events/${eventId}`).set('Authorization', `Bearer ${token}`);

describe('Inscriptions et capacite (E-03)', () => {
  it('confirme tant qu-il reste de la place', async () => {
    const organizer = await createUser();
    const player = await createUser();
    const event = await createEvent(organizer.accessToken, { capacity: 2 });

    const res = await join(player.accessToken, event.id);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('confirmed');
  });

  it('bascule l-evenement en full une fois la capacite atteinte', async () => {
    const organizer = await createUser();
    const player = await createUser();
    const event = await createEvent(organizer.accessToken, { capacity: 1 });

    await join(player.accessToken, event.id);

    const refreshed = await getEvent(organizer.accessToken, event.id);
    expect(refreshed.body.status).toBe('full');
  });

  it('place en liste d-attente au-dela de la capacite', async () => {
    const organizer = await createUser();
    const first = await createUser();
    const second = await createUser();
    const event = await createEvent(organizer.accessToken, { capacity: 1 });

    await join(first.accessToken, event.id);
    const res = await join(second.accessToken, event.id);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('waitlist');
  });

  it('refuse une double inscription', async () => {
    const organizer = await createUser();
    const player = await createUser();
    const event = await createEvent(organizer.accessToken, { capacity: 5 });

    await join(player.accessToken, event.id);
    const res = await join(player.accessToken, event.id);

    expect(res.status).toBe(400);
  });

  it('permet de se reinscrire apres un desistement', async () => {
    const organizer = await createUser();
    const player = await createUser();
    const event = await createEvent(organizer.accessToken, { capacity: 5 });

    await join(player.accessToken, event.id);
    await leave(player.accessToken, event.id);
    const res = await join(player.accessToken, event.id);

    // La contrainte unique (event_id, user_id) interdit une seconde ligne :
    // l-inscription annulee doit etre reactivee, pas dupliquee.
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('confirmed');
  });

  // La regression la plus couteuse : sans promotion, une place liberee est
  // perdue et la liste d-attente ne se vide jamais.
  it('promeut le premier de la liste d-attente quand une place se libere', async () => {
    const organizer = await createUser();
    const first = await createUser();
    const second = await createUser();
    const event = await createEvent(organizer.accessToken, { capacity: 1 });

    await join(first.accessToken, event.id);
    await join(second.accessToken, event.id);

    const res = await leave(first.accessToken, event.id);

    expect(res.status).toBe(200);
    expect(res.body.promotedUserId).toBe(second.id);

    const participants = await api()
      .get(`/api/events/${event.id}/participants`)
      .set('Authorization', `Bearer ${organizer.accessToken}`);
    expect(participants.body).toHaveLength(1);
    expect(participants.body[0].userId).toBe(second.id);
  });

  it('promeut dans l-ordre d-inscription', async () => {
    const organizer = await createUser();
    const confirmed = await createUser();
    const firstWaiting = await createUser();
    const secondWaiting = await createUser();
    const event = await createEvent(organizer.accessToken, { capacity: 1 });

    await join(confirmed.accessToken, event.id);
    await join(firstWaiting.accessToken, event.id);
    await join(secondWaiting.accessToken, event.id);

    const res = await leave(confirmed.accessToken, event.id);
    expect(res.body.promotedUserId).toBe(firstWaiting.id);
  });

  // Verifie le SELECT ... FOR UPDATE : sans verrou, les deux requetes lisent
  // le meme compteur et confirment toutes deux la derniere place.
  it('ne depasse pas la capacite sur deux inscriptions simultanees', async () => {
    const organizer = await createUser();
    const a = await createUser();
    const b = await createUser();
    const event = await createEvent(organizer.accessToken, { capacity: 1 });

    const [resA, resB] = await Promise.all([
      join(a.accessToken, event.id),
      join(b.accessToken, event.id),
    ]);

    const statuses = [resA.body.status, resB.body.status].sort();
    expect(statuses).toEqual(['confirmed', 'waitlist']);
  });
});

describe('Statuts d-evenement (E-02)', () => {
  it('autorise l-organisateur a annuler', async () => {
    const organizer = await createUser();
    const event = await createEvent(organizer.accessToken);

    const res = await api()
      .patch(`/api/events/${event.id}/status`)
      .set('Authorization', `Bearer ${organizer.accessToken}`)
      .send({ status: 'cancelled' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
  });

  it('interdit a un tiers de changer le statut', async () => {
    const organizer = await createUser();
    const intruder = await createUser();
    const event = await createEvent(organizer.accessToken);

    const res = await api()
      .patch(`/api/events/${event.id}/status`)
      .set('Authorization', `Bearer ${intruder.accessToken}`)
      .send({ status: 'cancelled' });

    expect(res.status).toBe(403);
  });

  it('refuse full en valeur imposee, car derive de la capacite', async () => {
    const organizer = await createUser();
    const event = await createEvent(organizer.accessToken);

    const res = await api()
      .patch(`/api/events/${event.id}/status`)
      .set('Authorization', `Bearer ${organizer.accessToken}`)
      .send({ status: 'full' });

    expect(res.status).toBe(400);
  });

  it('empeche de s-inscrire a un evenement annule', async () => {
    const organizer = await createUser();
    const player = await createUser();
    const event = await createEvent(organizer.accessToken);

    await api()
      .patch(`/api/events/${event.id}/status`)
      .set('Authorization', `Bearer ${organizer.accessToken}`)
      .send({ status: 'cancelled' });

    const res = await join(player.accessToken, event.id);
    expect(res.status).toBe(400);
  });
});

describe('Lien partageable public (E-07)', () => {
  it('expose un resume sans authentification', async () => {
    const organizer = await createUser();
    const player = await createUser();
    const event = await createEvent(organizer.accessToken, { capacity: 3 });
    await join(player.accessToken, event.id);

    const res = await api().get(`/api/events/shared/${event.shareableLinkToken}`);

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Five du mardi');
    expect(res.body.confirmedCount).toBe(1);
    expect(res.body.spotsLeft).toBe(2);
  });

  it('ne divulgue aucune donnee personnelle des participants', async () => {
    const organizer = await createUser();
    const player = await createUser();
    const event = await createEvent(organizer.accessToken);
    await join(player.accessToken, event.id);

    const res = await api().get(`/api/events/shared/${event.shareableLinkToken}`);
    const body = JSON.stringify(res.body);

    expect(body).not.toContain(player.email);
    expect(body).not.toContain(organizer.email);
    expect(res.body.participants).toBeUndefined();
  });

  it('renvoie 404 pour un evenement en brouillon', async () => {
    const organizer = await createUser();
    const event = await createEvent(organizer.accessToken);

    await api()
      .patch(`/api/events/${event.id}/status`)
      .set('Authorization', `Bearer ${organizer.accessToken}`)
      .send({ status: 'draft' });

    const res = await api().get(`/api/events/shared/${event.shareableLinkToken}`);
    expect(res.status).toBe(404);
  });

  it('renvoie 404 pour un token inconnu', async () => {
    const res = await api().get('/api/events/shared/3f2504e0-4f89-11d3-9a0c-0305e82c3301');
    expect(res.status).toBe(404);
  });
});

describe('Liste des evenements', () => {
  // Regression : le filtre ne gardait que 'open', donc un evenement complet
  // disparaissait de la liste des qu-il basculait en 'full'.
  it('conserve les evenements complets dans la liste', async () => {
    const organizer = await createUser();
    const player = await createUser();
    const event = await createEvent(organizer.accessToken, { capacity: 1 });
    await join(player.accessToken, event.id);

    const res = await api()
      .get('/api/events')
      .set('Authorization', `Bearer ${organizer.accessToken}`);

    expect(res.body.map((e: any) => e.id)).toContain(event.id);
  });
});
