import { api, createUser, createEvent } from './helpers';
import { UserModel as User } from '../src/models';

const authed = (token: string) => ({ Authorization: `Bearer ${token}` });

const createAdmin = async () => {
  const admin = await createUser();
  await User.update({ role: 'admin' } as any, { where: { id: admin.id } });
  return admin;
};

const addVenue = (token: string, body: Record<string, unknown> = {}) =>
  api()
    .post('/api/admin/venues')
    .set(authed(token))
    .send({ name: 'Le Five Reims', city: 'Reims', isPartner: true, ...body });

describe('Catalogue des complexes (PA-03)', () => {
  it('reference un complexe depuis le back-office', async () => {
    const admin = await createAdmin();

    const res = await addVenue(admin.accessToken);

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Le Five Reims');
    expect(res.body.active).toBe(true);
  });

  // Le catalogue engage la relation partenaire : il n'est pas alimente par
  // les joueurs.
  it('interdit a un joueur de referencer un complexe', async () => {
    const player = await createUser();

    const res = await addVenue(player.accessToken);

    expect(res.status).toBe(404);
  });

  it('laisse tout compte connecte consulter le catalogue', async () => {
    const admin = await createAdmin();
    const player = await createUser();
    await addVenue(admin.accessToken);

    const res = await api().get('/api/venues').set(authed(player.accessToken));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('filtre par ville', async () => {
    const admin = await createAdmin();
    await addVenue(admin.accessToken, { name: 'Le Five Reims', city: 'Reims' });
    await addVenue(admin.accessToken, { name: 'Urban Lille', city: 'Lille' });

    const res = await api().get('/api/venues?city=reims').set(authed(admin.accessToken));

    expect(res.body).toHaveLength(1);
    expect(res.body[0].city).toBe('Reims');
  });

  it('retire un complexe du catalogue sans effacer son historique', async () => {
    const admin = await createAdmin();
    const venue = await addVenue(admin.accessToken);
    const event = await createEvent(admin.accessToken, { venueId: venue.body.id });

    await api().delete(`/api/admin/venues/${venue.body.id}`).set(authed(admin.accessToken));

    const catalogue = await api().get('/api/venues').set(authed(admin.accessToken));
    expect(catalogue.body).toHaveLength(0);

    // L'evenement deja joue reste rattache.
    const kept = await api().get(`/api/events/${event.id}`).set(authed(admin.accessToken));
    expect(kept.body.venue.id).toBe(venue.body.id);
  });
});

describe('Attribution d-un evenement (PA-03)', () => {
  it('rattache un evenement a un complexe', async () => {
    const admin = await createAdmin();
    const venue = await addVenue(admin.accessToken);

    const event = await createEvent(admin.accessToken, { venueId: venue.body.id });

    const res = await api().get(`/api/events/${event.id}`).set(authed(admin.accessToken));
    expect(res.body.venue.name).toBe('Le Five Reims');
  });

  it('refuse un complexe inconnu', async () => {
    const user = await createUser();

    const res = await api()
      .post('/api/events')
      .set(authed(user.accessToken))
      .send({
        title: 'Five du mardi',
        dateTime: '2027-01-05T19:00:00.000Z',
        capacity: 10,
        venueId: '11111111-1111-1111-1111-111111111111',
      });

    expect(res.status).toBe(404);
  });

  it('refuse un complexe desactive', async () => {
    const admin = await createAdmin();
    const venue = await addVenue(admin.accessToken);
    await api().delete(`/api/admin/venues/${venue.body.id}`).set(authed(admin.accessToken));

    const res = await api()
      .post('/api/events')
      .set(authed(admin.accessToken))
      .send({
        title: 'Five du mardi',
        dateTime: '2027-01-05T19:00:00.000Z',
        capacity: 10,
        venueId: venue.body.id,
      });

    expect(res.status).toBe(404);
  });

  it('reste optionnel : un five hors complexe se cree toujours', async () => {
    const user = await createUser();

    const event = await createEvent(user.accessToken, { location: 'City stade du parc' });

    expect(event.venueId).toBeNull();
    expect(event.location).toBe('City stade du parc');
  });
});

describe('Duplication d-un evenement (E-04)', () => {
  const duplicate = (token: string, eventId: string, dateTime: string) =>
    api().post(`/api/events/${eventId}/duplicate`).set(authed(token)).send({ dateTime });

  it('copie l-evenement a une nouvelle date', async () => {
    const organizer = await createUser();
    const event = await createEvent(organizer.accessToken, {
      title: 'Five du mardi',
      capacity: 12,
      location: 'Le Five',
    });

    const res = await duplicate(organizer.accessToken, event.id, '2027-01-12T19:00:00.000Z');

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Five du mardi');
    expect(res.body.capacity).toBe(12);
    expect(res.body.location).toBe('Le Five');
    expect(res.body.id).not.toBe(event.id);
  });

  // E-04 exige une validation humaine : la copie doit etre relue avant
  // d-etre ouverte.
  it('cree la copie en brouillon', async () => {
    const organizer = await createUser();
    const event = await createEvent(organizer.accessToken);

    const res = await duplicate(organizer.accessToken, event.id, '2027-01-12T19:00:00.000Z');

    expect(res.body.status).toBe('draft');
  });

  it('donne un lien partageable distinct', async () => {
    const organizer = await createUser();
    const event = await createEvent(organizer.accessToken);

    const res = await duplicate(organizer.accessToken, event.id, '2027-01-12T19:00:00.000Z');

    expect(res.body.shareableLinkToken).not.toBe(event.shareableLinkToken);
  });

  // Reconduire les inscrits reviendrait a les engager sans leur demander.
  it('ne reprend aucune inscription', async () => {
    const organizer = await createUser();
    const player = await createUser();
    const event = await createEvent(organizer.accessToken);
    await api().post(`/api/events/${event.id}/join`).set(authed(player.accessToken));

    const copy = await duplicate(organizer.accessToken, event.id, '2027-01-12T19:00:00.000Z');

    const participants = await api()
      .get(`/api/events/${copy.body.id}/participants`)
      .set(authed(organizer.accessToken));

    expect(participants.body).toHaveLength(0);
  });

  it('interdit la duplication a un tiers', async () => {
    const organizer = await createUser();
    const stranger = await createUser();
    const event = await createEvent(organizer.accessToken);

    const res = await duplicate(stranger.accessToken, event.id, '2027-01-12T19:00:00.000Z');

    expect(res.status).toBe(403);
  });

  it('refuse une date passee', async () => {
    const organizer = await createUser();
    const event = await createEvent(organizer.accessToken);

    const res = await duplicate(organizer.accessToken, event.id, '2020-01-12T19:00:00.000Z');

    expect(res.status).toBe(400);
  });
});
