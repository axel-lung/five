import { api, createUser, createEvent, createGroup } from './helpers';

const join = (token: string, eventId: string) =>
  api().post(`/api/events/${eventId}/join`).set('Authorization', `Bearer ${token}`);

const leave = (token: string, eventId: string, newOrganizerId?: string) =>
  api()
    .post(`/api/events/${eventId}/leave`)
    .set('Authorization', `Bearer ${token}`)
    .send(newOrganizerId ? { newOrganizerId } : {});

const withdraw = (token: string, eventId: string) =>
  api().post(`/api/events/${eventId}/withdraw`).set('Authorization', `Bearer ${token}`);

const transfer = (token: string, eventId: string, newOrganizerId: string) =>
  api()
    .post(`/api/events/${eventId}/transfer-ownership`)
    .set('Authorization', `Bearer ${token}`)
    .send({ newOrganizerId });

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

describe('Depart de l-organisateur (E-03)', () => {
  it('refuse de partir sans designer de successeur', async () => {
    const organizer = await createUser();
    const player = await createUser();
    const event = await createEvent(organizer.accessToken);
    await join(player.accessToken, event.id);

    const res = await leave(organizer.accessToken, event.id);

    expect(res.status).toBe(409);
    expect(res.body.reason).toBe('ORGANIZER_MUST_TRANSFER');

    // Le refus doit etre total : une session a demi quittee, sans organisateur,
    // est exactement ce que la regle cherche a empecher.
    const refreshed = await getEvent(player.accessToken, event.id);
    expect(refreshed.body.organizerId).toBe(organizer.id);
  });

  it('signale l-organisateur reste seul, plutot que de le laisser partir', async () => {
    const organizer = await createUser();
    const event = await createEvent(organizer.accessToken);

    const res = await leave(organizer.accessToken, event.id);

    expect(res.status).toBe(409);
    expect(res.body.reason).toBe('ORGANIZER_ALONE');
  });

  it('legue la session au successeur designe et retire le partant', async () => {
    const organizer = await createUser();
    const player = await createUser();
    const event = await createEvent(organizer.accessToken);
    await join(organizer.accessToken, event.id);
    await join(player.accessToken, event.id);

    const res = await leave(organizer.accessToken, event.id, player.id);

    expect(res.status).toBe(200);
    expect(res.body.newOrganizerId).toBe(player.id);

    const refreshed = await getEvent(player.accessToken, event.id);
    expect(refreshed.body.organizerId).toBe(player.id);

    const participants = await api()
      .get(`/api/events/${event.id}/participants`)
      .set('Authorization', `Bearer ${player.accessToken}`);
    expect(participants.body.map((p: any) => p.userId)).toEqual([player.id]);
  });

  it('accepte un successeur pris dans la liste d-attente', async () => {
    const organizer = await createUser();
    const waiting = await createUser();
    const event = await createEvent(organizer.accessToken, { capacity: 1 });
    await join(organizer.accessToken, event.id);
    await join(waiting.accessToken, event.id);

    const res = await leave(organizer.accessToken, event.id, waiting.id);

    expect(res.status).toBe(200);

    // La place liberee lui revient au passage : il est promu confirme et se
    // retrouve organisateur de la session qu-il attendait.
    const refreshed = await getEvent(waiting.accessToken, event.id);
    expect(refreshed.body.organizerId).toBe(waiting.id);
    expect(refreshed.body.status).toBe('full');
  });

  it('refuse un successeur qui n-est pas dans la session', async () => {
    const organizer = await createUser();
    const player = await createUser();
    const outsider = await createUser();
    const event = await createEvent(organizer.accessToken);
    await join(player.accessToken, event.id);

    const res = await leave(organizer.accessToken, event.id, outsider.id);

    expect(res.status).toBe(404);
  });

  // Une session terminee n-a plus rien a administrer : exiger une transmission
  // pour la quitter n-aurait aucun sens.
  it('laisse quitter une session terminee sans transmission', async () => {
    const organizer = await createUser();
    const player = await createUser();
    const event = await createEvent(organizer.accessToken);
    await join(organizer.accessToken, event.id);
    await join(player.accessToken, event.id);

    await api()
      .patch(`/api/events/${event.id}/status`)
      .set('Authorization', `Bearer ${organizer.accessToken}`)
      .send({ status: 'completed' });

    const res = await leave(organizer.accessToken, event.id);
    expect(res.status).toBe(200);
  });

  // La nuance que /leave ne couvre pas : l-organisateur blesse rend sa place
  // mais continue d-administrer la session.
  it('laisse l-organisateur liberer sa place sans lacher l-organisation', async () => {
    const organizer = await createUser();
    const player = await createUser();
    const event = await createEvent(organizer.accessToken);
    await join(organizer.accessToken, event.id);
    await join(player.accessToken, event.id);

    const res = await withdraw(organizer.accessToken, event.id);

    expect(res.status).toBe(200);

    const refreshed = await getEvent(player.accessToken, event.id);
    expect(refreshed.body.organizerId).toBe(organizer.id);
  });

  it('transmet l-organisation sans quitter la session', async () => {
    const organizer = await createUser();
    const player = await createUser();
    const event = await createEvent(organizer.accessToken);
    await join(organizer.accessToken, event.id);
    await join(player.accessToken, event.id);

    const res = await transfer(organizer.accessToken, event.id, player.id);

    expect(res.status).toBe(200);

    const refreshed = await getEvent(organizer.accessToken, event.id);
    expect(refreshed.body.organizerId).toBe(player.id);

    // L-ancien organisateur reste sur le terrain : il a passe la main, pas
    // rendu sa place.
    const participants = await api()
      .get(`/api/events/${event.id}/participants`)
      .set('Authorization', `Bearer ${player.accessToken}`);
    expect(participants.body.map((p: any) => p.userId).sort()).toEqual(
      [organizer.id, player.id].sort()
    );
  });

  it('interdit a un tiers de transmettre l-organisation', async () => {
    const organizer = await createUser();
    const player = await createUser();
    const intruder = await createUser();
    const event = await createEvent(organizer.accessToken);
    await join(player.accessToken, event.id);

    const res = await transfer(intruder.accessToken, event.id, player.id);

    expect(res.status).toBe(403);
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

describe('Visibilite des evenements (G-06 / C-04)', () => {
  const invite = (token: string, groupId: string) =>
    api().post(`/api/groups/${groupId}/invitations`).set('Authorization', `Bearer ${token}`).send({});

  const accept = (token: string, inviteToken: string) =>
    api().post(`/api/groups/invitations/${inviteToken}/accept`).set('Authorization', `Bearer ${token}`);

  /** Un organisateur, son groupe prive, un evenement dedans, et un membre. */
  const privateGroupEvent = async () => {
    const organizer = await createUser();
    const member = await createUser();
    const outsider = await createUser();

    const group = await createGroup(organizer.accessToken, { accessType: 'private' });
    const invitation = await invite(organizer.accessToken, group.id);
    await accept(member.accessToken, invitation.body.token);

    const event = await createEvent(organizer.accessToken, { groupId: group.id });
    return { organizer, member, outsider, group, event };
  };

  it('renvoie 404 a un tiers sur l-evenement d-un groupe prive', async () => {
    const { outsider, event } = await privateGroupEvent();

    const res = await getEvent(outsider.accessToken, event.id);
    expect(res.status).toBe(404);
  });

  it('laisse un membre du groupe consulter l-evenement', async () => {
    const { member, event } = await privateGroupEvent();

    const res = await getEvent(member.accessToken, event.id);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(event.id);
  });

  it('laisse toujours l-organisateur consulter son evenement', async () => {
    const { organizer, event } = await privateGroupEvent();

    const res = await getEvent(organizer.accessToken, event.id);
    expect(res.status).toBe(200);
  });

  it('ne liste pas l-evenement d-un groupe prive tiers', async () => {
    const { outsider, event } = await privateGroupEvent();

    const res = await api()
      .get('/api/events')
      .set('Authorization', `Bearer ${outsider.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.map((e: any) => e.id)).not.toContain(event.id);
  });

  it('liste l-evenement d-un groupe public', async () => {
    const organizer = await createUser();
    const outsider = await createUser();
    const group = await createGroup(organizer.accessToken, { accessType: 'public' });
    const event = await createEvent(organizer.accessToken, { groupId: group.id });

    const res = await api()
      .get('/api/events')
      .set('Authorization', `Bearer ${outsider.accessToken}`);

    expect(res.body.map((e: any) => e.id)).toContain(event.id);
  });

  it('renvoie 404 a un tiers sur les participants d-un groupe prive', async () => {
    const { outsider, event } = await privateGroupEvent();

    const res = await api()
      .get(`/api/events/${event.id}/participants`)
      .set('Authorization', `Bearer ${outsider.accessToken}`);

    expect(res.status).toBe(404);
  });
});

describe('Donnees personnelles des participants (C-04)', () => {
  // Le nettoyage avait ete fait cote groupes mais jamais reporte ici : les
  // includes renvoyaient encore email et telephone en clair.
  it('n-expose ni email ni telephone dans le detail d-un evenement', async () => {
    const organizer = await createUser({ phone: '0600000000' });
    const player = await createUser({ phone: '0611111111' });
    const event = await createEvent(organizer.accessToken);
    await join(player.accessToken, event.id);

    const res = await getEvent(player.accessToken, event.id);

    expect(res.status).toBe(200);
    expect(res.body.organizer).not.toHaveProperty('email');
    expect(res.body.organizer).not.toHaveProperty('phone');
    expect(res.body.participants).toHaveLength(1);
    expect(res.body.participants[0]).not.toHaveProperty('email');
    expect(res.body.participants[0]).not.toHaveProperty('phone');
  });

  it('n-expose ni email ni telephone dans la liste des participants', async () => {
    const organizer = await createUser();
    const player = await createUser({ phone: '0611111111' });
    const event = await createEvent(organizer.accessToken);
    await join(player.accessToken, event.id);

    const res = await api()
      .get(`/api/events/${event.id}/participants`)
      .set('Authorization', `Bearer ${organizer.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body[0].user).not.toHaveProperty('email');
    expect(res.body[0].user).not.toHaveProperty('phone');
  });

  it('n-expose pas l-email de l-organisateur dans la liste des evenements', async () => {
    const organizer = await createUser();
    await createEvent(organizer.accessToken);

    const res = await api()
      .get('/api/events')
      .set('Authorization', `Bearer ${organizer.accessToken}`);

    expect(res.body[0].organizer).not.toHaveProperty('email');
  });
});
