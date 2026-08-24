import { api, createUser, createEvent, createGroup } from './helpers';

const authed = (token: string) => ({ Authorization: `Bearer ${token}` });

const join = (token: string, eventId: string) =>
  api().post(`/api/events/${eventId}/join`).set(authed(token));

const leave = (token: string, eventId: string) =>
  api().post(`/api/events/${eventId}/leave`).set(authed(token));

const inbox = (token: string) => api().get('/api/notifications').set(authed(token));

const invite = (token: string, groupId: string) =>
  api().post(`/api/groups/${groupId}/invitations`).set(authed(token)).send({});

const accept = (token: string, inviteToken: string) =>
  api().post(`/api/groups/invitations/${inviteToken}/accept`).set(authed(token));

describe('Emission des notifications (N-01)', () => {
  it('previent le promu quand une place se libere', async () => {
    const organizer = await createUser();
    const first = await createUser();
    const second = await createUser();
    const event = await createEvent(organizer.accessToken, { capacity: 1 });

    await join(first.accessToken, event.id);
    await join(second.accessToken, event.id);
    await leave(first.accessToken, event.id);

    const res = await inbox(second.accessToken);
    expect(res.body.notifications.map((n: any) => n.type)).toContain('event.spot_released');
    expect(res.body.notifications[0].payload.eventId).toBe(event.id);
  });

  it('ne previent personne quand la liste d-attente est vide', async () => {
    const organizer = await createUser();
    const player = await createUser();
    const event = await createEvent(organizer.accessToken, { capacity: 2 });

    await join(player.accessToken, event.id);
    await leave(player.accessToken, event.id);

    const res = await inbox(player.accessToken);
    expect(res.body.notifications).toHaveLength(0);
  });

  it('previent les inscrits d-une annulation', async () => {
    const organizer = await createUser();
    const player = await createUser();
    const event = await createEvent(organizer.accessToken);
    await join(player.accessToken, event.id);

    await api()
      .patch(`/api/events/${event.id}/status`)
      .set(authed(organizer.accessToken))
      .send({ status: 'cancelled' });

    const res = await inbox(player.accessToken);
    expect(res.body.notifications.map((n: any) => n.type)).toContain('event.cancelled');
  });

  it('previent les inscrits d-un changement d-heure', async () => {
    const organizer = await createUser();
    const player = await createUser();
    const event = await createEvent(organizer.accessToken);
    await join(player.accessToken, event.id);

    await api()
      .put(`/api/events/${event.id}`)
      .set(authed(organizer.accessToken))
      .send({ title: event.title, dateTime: '2027-02-09T20:30:00.000Z', capacity: 10 });

    const res = await inbox(player.accessToken);
    expect(res.body.notifications.map((n: any) => n.type)).toContain('event.updated');
  });

  // Un titre corrige ne doit pas reveiller tout le groupe.
  it('ne notifie pas une modification sans changement d-heure ni de lieu', async () => {
    const organizer = await createUser();
    const player = await createUser();
    const event = await createEvent(organizer.accessToken);
    await join(player.accessToken, event.id);

    await api()
      .put(`/api/events/${event.id}`)
      .set(authed(organizer.accessToken))
      .send({ title: 'Titre corrige', dateTime: event.dateTime, capacity: 10 });

    const res = await inbox(player.accessToken);
    expect(res.body.notifications).toHaveLength(0);
  });

  it('ne se notifie jamais soi-meme', async () => {
    const organizer = await createUser();
    const player = await createUser();
    const event = await createEvent(organizer.accessToken);
    await join(player.accessToken, event.id);

    await api()
      .patch(`/api/events/${event.id}/status`)
      .set(authed(organizer.accessToken))
      .send({ status: 'cancelled' });

    const res = await inbox(organizer.accessToken);
    expect(res.body.notifications).toHaveLength(0);
  });
});

describe('Centre de notifications (N-05)', () => {
  const withOneNotification = async () => {
    const organizer = await createUser();
    const player = await createUser();
    const event = await createEvent(organizer.accessToken);
    await join(player.accessToken, event.id);
    await api()
      .patch(`/api/events/${event.id}/status`)
      .set(authed(organizer.accessToken))
      .send({ status: 'cancelled' });
    return player;
  };

  it('compte les non lues', async () => {
    const player = await withOneNotification();

    const res = await inbox(player.accessToken);
    expect(res.body.unreadCount).toBe(1);
  });

  it('marque une notification comme lue', async () => {
    const player = await withOneNotification();
    const before = await inbox(player.accessToken);
    const id = before.body.notifications[0].id;

    const res = await api().patch(`/api/notifications/${id}/read`).set(authed(player.accessToken));
    expect(res.status).toBe(200);

    const after = await inbox(player.accessToken);
    expect(after.body.unreadCount).toBe(0);
  });

  it('filtre les non lues', async () => {
    const player = await withOneNotification();
    const before = await inbox(player.accessToken);
    await api()
      .patch(`/api/notifications/${before.body.notifications[0].id}/read`)
      .set(authed(player.accessToken));

    const res = await api()
      .get('/api/notifications?unread=true')
      .set(authed(player.accessToken));

    expect(res.body.notifications).toHaveLength(0);
  });

  it('interdit de marquer la notification d-un autre', async () => {
    const player = await withOneNotification();
    const stranger = await createUser();
    const before = await inbox(player.accessToken);

    const res = await api()
      .patch(`/api/notifications/${before.body.notifications[0].id}/read`)
      .set(authed(stranger.accessToken));

    expect(res.status).toBe(404);
  });
});

describe('Preferences de notification (N-04)', () => {
  it('renvoie des valeurs par defaut sans configuration prealable', async () => {
    const user = await createUser();

    const res = await api().get('/api/notifications/preferences').set(authed(user.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.pushEnabled).toBe(true);
    expect(res.body.quietHoursStart).toBeNull();
  });

  it('enregistre des heures de silence', async () => {
    const user = await createUser();

    const res = await api()
      .put('/api/notifications/preferences')
      .set(authed(user.accessToken))
      .send({ pushEnabled: false, quietHoursStart: 22, quietHoursEnd: 8 });

    expect(res.status).toBe(200);
    expect(res.body.pushEnabled).toBe(false);
    expect(res.body.quietHoursStart).toBe(22);
  });

  it('refuse une heure hors bornes', async () => {
    const user = await createUser();

    const res = await api()
      .put('/api/notifications/preferences')
      .set(authed(user.accessToken))
      .send({ quietHoursStart: 25 });

    expect(res.status).toBe(400);
  });
});

describe('Relance des non-repondants (N-03)', () => {
  /** Un groupe, son evenement, et un membre qui n-a pas encore repondu. */
  const groupWithSilentMember = async () => {
    const organizer = await createUser();
    const silent = await createUser();
    const group = await createGroup(organizer.accessToken);
    const invitation = await invite(organizer.accessToken, group.id);
    await accept(silent.accessToken, invitation.body.token);
    const event = await createEvent(organizer.accessToken, { groupId: group.id });
    return { organizer, silent, group, event };
  };

  it('relance les membres sans reponse', async () => {
    const { organizer, silent, event } = await groupWithSilentMember();

    const res = await api().post(`/api/events/${event.id}/remind`).set(authed(organizer.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.recipientCount).toBe(1);

    const notifications = await inbox(silent.accessToken);
    expect(notifications.body.notifications.map((n: any) => n.type)).toContain('event.reminder');
  });

  it('ne relance pas ceux qui ont deja repondu', async () => {
    const { organizer, silent, event } = await groupWithSilentMember();
    await join(silent.accessToken, event.id);

    const res = await api().post(`/api/events/${event.id}/remind`).set(authed(organizer.accessToken));

    expect(res.body.recipientCount).toBe(0);
  });

  // Le coeur de l-exigence anti-spam de N-03.
  it('plafonne a une relance par jour', async () => {
    const { organizer, event } = await groupWithSilentMember();

    await api().post(`/api/events/${event.id}/remind`).set(authed(organizer.accessToken));
    const second = await api()
      .post(`/api/events/${event.id}/remind`)
      .set(authed(organizer.accessToken));

    expect(second.status).toBe(429);
  });

  it('interdit la relance a un tiers', async () => {
    const { silent, event } = await groupWithSilentMember();

    const res = await api().post(`/api/events/${event.id}/remind`).set(authed(silent.accessToken));

    expect(res.status).toBe(403);
  });
});
