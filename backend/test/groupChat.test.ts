import { api, createUser, createGroup } from './helpers';

const send = (token: string, groupId: string, body: Record<string, unknown>) =>
  api()
    .post(`/api/groups/${groupId}/messages`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);

const list = (token: string, groupId: string, query: Record<string, unknown> = {}) =>
  api()
    .get(`/api/groups/${groupId}/messages`)
    .set('Authorization', `Bearer ${token}`)
    .query(query as any);

const join = async (ownerToken: string, groupId: string, memberToken: string) => {
  const invitation = await api()
    .post(`/api/groups/${groupId}/invitations`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({});

  await api()
    .post(`/api/groups/invitations/${invitation.body.token}/accept`)
    .set('Authorization', `Bearer ${memberToken}`);
};

describe('Chat de groupe — envoi (S-01)', () => {
  it('accepte un message d-un membre et n-expose pas les donnees privees de l-auteur', async () => {
    const owner = await createUser();
    const group = await createGroup(owner.accessToken);

    const res = await send(owner.accessToken, group.id, { body: 'On joue mardi ?' });

    expect(res.status).toBe(201);
    expect(res.body.body).toBe('On joue mardi ?');
    expect(res.body.author.firstName).toBeDefined();
    // Garde-fou PUBLIC_USER_ATTRIBUTES : une fuite d'email a deja eu lieu ici.
    expect(res.body.author.email).toBeUndefined();
    expect(res.body.author.phone).toBeUndefined();
  });

  it('rend les messages du plus recent au plus ancien', async () => {
    const owner = await createUser();
    const group = await createGroup(owner.accessToken);

    await send(owner.accessToken, group.id, { body: 'premier' });
    await send(owner.accessToken, group.id, { body: 'second' });

    const res = await list(owner.accessToken, group.id);

    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(2);
    expect(res.body.messages[0].body).toBe('second');
    expect(res.body.hasMore).toBe(false);
  });

  it('refuse un corps vide ou trop long', async () => {
    const owner = await createUser();
    const group = await createGroup(owner.accessToken);

    expect((await send(owner.accessToken, group.id, { body: '   ' })).status).toBe(400);
    expect((await send(owner.accessToken, group.id, { body: 'x'.repeat(2001) })).status).toBe(400);
  });

  it('ne cree qu-un message pour un meme clientNonce rejoue', async () => {
    const owner = await createUser();
    const group = await createGroup(owner.accessToken);
    const clientNonce = '11111111-1111-4111-8111-111111111111';

    const first = await send(owner.accessToken, group.id, { body: 'envoi', clientNonce });
    const replay = await send(owner.accessToken, group.id, { body: 'envoi', clientNonce });

    expect(first.status).toBe(201);
    expect(replay.status).toBe(200);
    expect(replay.body.id).toBe(first.body.id);

    const res = await list(owner.accessToken, group.id);
    expect(res.body.messages).toHaveLength(1);
  });
});

describe('Chat de groupe — autorisation', () => {
  it('renvoie 404 et jamais 403 a un non-membre d-un groupe prive', async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const group = await createGroup(owner.accessToken, { accessType: 'private' });

    expect((await list(outsider.accessToken, group.id)).status).toBe(404);
    expect((await send(outsider.accessToken, group.id, { body: 'coucou' })).status).toBe(404);
  });

  it('renvoie 403 a un non-membre d-un groupe public, dont l-existence est deja publique', async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const group = await createGroup(owner.accessToken, { accessType: 'public' });

    expect((await list(outsider.accessToken, group.id)).status).toBe(403);
    expect((await send(outsider.accessToken, group.id, { body: 'coucou' })).status).toBe(403);
  });

  it('exige un jeton', async () => {
    const owner = await createUser();
    const group = await createGroup(owner.accessToken);

    expect((await api().get(`/api/groups/${group.id}/messages`)).status).toBe(401);
  });

  it('coupe l-acces au membre retire du groupe', async () => {
    const owner = await createUser();
    const member = await createUser();
    const group = await createGroup(owner.accessToken);
    await join(owner.accessToken, group.id, member.accessToken);

    expect((await list(member.accessToken, group.id)).status).toBe(200);

    const removal = await api()
      .delete(`/api/groups/${group.id}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ memberId: member.id });

    // Assertion volontaire : sans elle, un retrait qui echoue silencieusement
    // (mauvais nom de champ, par exemple) ferait passer le test pour la
    // mauvaise raison.
    expect(removal.status).toBe(200);
    expect((await list(member.accessToken, group.id)).status).toBe(404);
  });

  it('renvoie 404 sur un groupe inconnu', async () => {
    const owner = await createUser();
    const res = await list(owner.accessToken, '11111111-1111-4111-8111-999999999999');
    expect(res.status).toBe(404);
  });
});

describe('Chat de groupe — blocage (D-06)', () => {
  it('masque en lecture les messages d-un compte bloque, dans les deux sens', async () => {
    const owner = await createUser();
    const blocked = await createUser();
    const neutral = await createUser();
    const group = await createGroup(owner.accessToken);
    await join(owner.accessToken, group.id, blocked.accessToken);
    await join(owner.accessToken, group.id, neutral.accessToken);

    await api()
      .post(`/api/users/${blocked.id}/block`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({});

    await send(blocked.accessToken, group.id, { body: 'de la personne bloquee' });
    await send(neutral.accessToken, group.id, { body: 'de la personne neutre' });

    const seenByOwner = await list(owner.accessToken, group.id);
    const bodies = seenByOwner.body.messages.map((m: any) => m.body);
    expect(bodies).toContain('de la personne neutre');
    expect(bodies).not.toContain('de la personne bloquee');

    // Le blocage est symetrique a l'usage : la personne bloquee ne voit pas
    // non plus les messages de celle qui l'a bloquee.
    await send(owner.accessToken, group.id, { body: 'du proprietaire' });
    const seenByBlocked = await list(blocked.accessToken, group.id);
    expect(seenByBlocked.body.messages.map((m: any) => m.body)).not.toContain('du proprietaire');
  });

  it('n-empeche pas la personne bloquee de poster', async () => {
    const owner = await createUser();
    const blocked = await createUser();
    const group = await createGroup(owner.accessToken);
    await join(owner.accessToken, group.id, blocked.accessToken);

    await api()
      .post(`/api/users/${blocked.id}/block`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({});

    // Sinon n'importe quel membre baillonnerait n'importe quel autre pour
    // tout le groupe, d'un simple blocage.
    const res = await send(blocked.accessToken, group.id, { body: 'je parle quand meme' });
    expect(res.status).toBe(201);
  });
});

describe('Chat de groupe — pagination', () => {
  it('pagine par curseur sans doublon ni trou', async () => {
    const owner = await createUser();
    const group = await createGroup(owner.accessToken);

    for (let i = 0; i < 35; i += 1) {
      await send(owner.accessToken, group.id, { body: `message ${i}` });
    }

    const first = await list(owner.accessToken, group.id, { limit: 20 });
    expect(first.body.messages).toHaveLength(20);
    expect(first.body.hasMore).toBe(true);

    const second = await list(owner.accessToken, group.id, {
      limit: 20,
      before: first.body.nextCursor.before,
      beforeId: first.body.nextCursor.beforeId,
    });

    expect(second.body.messages).toHaveLength(15);
    expect(second.body.hasMore).toBe(false);

    const ids = [
      ...first.body.messages.map((m: any) => m.id),
      ...second.body.messages.map((m: any) => m.id),
    ];
    expect(new Set(ids).size).toBe(35);
  });

  it('refuse un curseur incomplet ou deux modes a la fois', async () => {
    const owner = await createUser();
    const group = await createGroup(owner.accessToken);

    const partial = await list(owner.accessToken, group.id, {
      before: new Date().toISOString(),
    });
    expect(partial.status).toBe(400);

    const both = await list(owner.accessToken, group.id, {
      before: new Date().toISOString(),
      beforeId: '11111111-1111-4111-8111-111111111111',
      since: new Date().toISOString(),
    });
    expect(both.status).toBe(400);
  });
});

describe('Chat de groupe — suppression', () => {
  const remove = (token: string, groupId: string, messageId: string) =>
    api()
      .delete(`/api/groups/${groupId}/messages/${messageId}`)
      .set('Authorization', `Bearer ${token}`);

  it('laisse une pierre tombale videe de son contenu', async () => {
    const owner = await createUser();
    const group = await createGroup(owner.accessToken);
    const sent = await send(owner.accessToken, group.id, { body: 'a effacer' });

    const res = await remove(owner.accessToken, group.id, sent.body.id);

    expect(res.status).toBe(200);
    expect(res.body.deletedAt).not.toBeNull();
    expect(res.body.body).toBeNull();

    // La tombale reste dans le fil : c'est elle qui porte la suppression
    // jusqu'aux clients qui ont manque la trame temps reel.
    const listed = await list(owner.accessToken, group.id);
    expect(listed.body.messages).toHaveLength(1);
    expect(listed.body.messages[0].deletedAt).not.toBeNull();
  });

  it('refuse a un simple membre de supprimer le message d-un autre', async () => {
    const owner = await createUser();
    const member = await createUser();
    const group = await createGroup(owner.accessToken);
    await join(owner.accessToken, group.id, member.accessToken);

    const sent = await send(owner.accessToken, group.id, { body: 'du proprietaire' });
    const res = await remove(member.accessToken, group.id, sent.body.id);

    expect(res.status).toBe(403);
  });

  it('autorise le proprietaire a moderer le message d-un membre', async () => {
    const owner = await createUser();
    const member = await createUser();
    const group = await createGroup(owner.accessToken);
    await join(owner.accessToken, group.id, member.accessToken);

    const sent = await send(member.accessToken, group.id, { body: 'a moderer' });
    const res = await remove(owner.accessToken, group.id, sent.body.id);

    expect(res.status).toBe(200);
    expect(res.body.deletedBy).toBe(owner.id);
  });

  it('autorise un admin a moderer', async () => {
    const owner = await createUser();
    const admin = await createUser();
    const member = await createUser();
    const group = await createGroup(owner.accessToken);
    await join(owner.accessToken, group.id, admin.accessToken);
    await join(owner.accessToken, group.id, member.accessToken);

    await api()
      .patch(`/api/groups/${group.id}/members/${admin.id}/role`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ role: 'admin' });

    const sent = await send(member.accessToken, group.id, { body: 'a moderer' });
    const res = await remove(admin.accessToken, group.id, sent.body.id);

    expect(res.status).toBe(200);
  });

  it('est idempotente', async () => {
    const owner = await createUser();
    const group = await createGroup(owner.accessToken);
    const sent = await send(owner.accessToken, group.id, { body: 'a effacer' });

    const first = await remove(owner.accessToken, group.id, sent.body.id);
    const second = await remove(owner.accessToken, group.id, sent.body.id);

    expect(second.status).toBe(200);
    expect(second.body.deletedAt).toBe(first.body.deletedAt);
  });

  it('ne revele pas l-existence d-un message d-un autre groupe', async () => {
    const owner = await createUser();
    const mine = await createGroup(owner.accessToken, { name: 'Le mien' });
    const other = await createGroup(owner.accessToken, { name: 'L-autre' });

    const sent = await send(owner.accessToken, other.id, { body: 'ailleurs' });
    const res = await remove(owner.accessToken, mine.id, sent.body.id);

    expect(res.status).toBe(404);
  });
});

describe('Chat de groupe — non-lus', () => {
  const unreadFor = async (token: string, groupId: string) => {
    const res = await api().get('/api/groups').set('Authorization', `Bearer ${token}`);
    return res.body.find((g: any) => g.id === groupId)?.unreadCount;
  };

  const markRead = (token: string, groupId: string, body: Record<string, unknown> = {}) =>
    api()
      .post(`/api/groups/${groupId}/messages/read`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  it('compte les messages des autres, jamais les siens', async () => {
    const owner = await createUser();
    const member = await createUser();
    const group = await createGroup(owner.accessToken);
    await join(owner.accessToken, group.id, member.accessToken);

    await send(owner.accessToken, group.id, { body: 'un' });
    await send(owner.accessToken, group.id, { body: 'deux' });
    await send(owner.accessToken, group.id, { body: 'trois' });

    expect(await unreadFor(member.accessToken, group.id)).toBe(3);
    expect(await unreadFor(owner.accessToken, group.id)).toBe(0);
  });

  it('remet le compteur a zero apres marquage', async () => {
    const owner = await createUser();
    const member = await createUser();
    const group = await createGroup(owner.accessToken);
    await join(owner.accessToken, group.id, member.accessToken);
    await send(owner.accessToken, group.id, { body: 'un' });

    const res = await markRead(member.accessToken, group.id);

    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBe(0);
    expect(await unreadFor(member.accessToken, group.id)).toBe(0);
  });

  it('ne fait jamais remonter le compteur : le marquage est monotone', async () => {
    const owner = await createUser();
    const member = await createUser();
    const group = await createGroup(owner.accessToken);
    await join(owner.accessToken, group.id, member.accessToken);
    await send(owner.accessToken, group.id, { body: 'un' });
    await markRead(member.accessToken, group.id);

    // Un marquage tardif portant une date anterieure ne doit pas « delire »
    // ce qui l'a deja ete.
    const late = await markRead(member.accessToken, group.id, {
      upTo: new Date(Date.now() - 3600_000).toISOString(),
    });

    expect(late.body.unreadCount).toBe(0);
  });

  it('expose le total par groupe, sur une route litterale non capturee par /:id', async () => {
    const owner = await createUser();
    const member = await createUser();
    const group = await createGroup(owner.accessToken);
    await join(owner.accessToken, group.id, member.accessToken);
    await send(owner.accessToken, group.id, { body: 'un' });
    await send(owner.accessToken, group.id, { body: 'deux' });

    const res = await api()
      .get('/api/groups/unread')
      .set('Authorization', `Bearer ${member.accessToken}`);

    // Si '/unread' passait apres '/:id', cette route renverrait un objet
    // groupe (ou 404) au lieu du compteur. C'est ce test qui epingle l'ordre.
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.byGroup[group.id]).toBe(2);
  });

  it('n-inflige pas l-arriere d-un groupe bavard a un nouveau membre', async () => {
    const owner = await createUser();
    const latecomer = await createUser();
    const group = await createGroup(owner.accessToken);

    await send(owner.accessToken, group.id, { body: 'avant son arrivee' });
    await send(owner.accessToken, group.id, { body: 'avant aussi' });

    await join(owner.accessToken, group.id, latecomer.accessToken);

    // Le filigrane retombe sur joined_at : rejoindre un groupe ne doit pas
    // ouvrir sur des centaines de non-lus.
    expect(await unreadFor(latecomer.accessToken, group.id)).toBe(0);
  });

  it('cesse de compter un message supprime', async () => {
    const owner = await createUser();
    const member = await createUser();
    const group = await createGroup(owner.accessToken);
    await join(owner.accessToken, group.id, member.accessToken);

    const sent = await send(owner.accessToken, group.id, { body: 'a effacer' });
    expect(await unreadFor(member.accessToken, group.id)).toBe(1);

    await api()
      .delete(`/api/groups/${group.id}/messages/${sent.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(await unreadFor(member.accessToken, group.id)).toBe(0);
  });
});

describe('Chat de groupe — images', () => {
  /** Un PNG 1x1 valide, assez reel pour traverser multer. */
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );

  const sendImage = (
    token: string,
    groupId: string,
    buffer: Buffer,
    filename = 'photo.png',
    contentType = 'image/png'
  ) =>
    api()
      .post(`/api/groups/${groupId}/messages/image`)
      .set('Authorization', `Bearer ${token}`)
      .attach('image', buffer, { filename, contentType });

  it('accepte une image et la ressert sans authentification', async () => {
    const owner = await createUser();
    const group = await createGroup(owner.accessToken);

    const res = await sendImage(owner.accessToken, group.id, PNG);

    expect(res.status).toBe(201);
    expect(res.body.imageUrl).toMatch(/^\/api\/media\/[0-9a-f-]{36}\.png$/);
    expect(res.body.body).toBeNull();

    const media = await api().get(res.body.imageUrl);
    expect(media.status).toBe(200);
    expect(media.headers['content-type']).toContain('image/png');
  });

  it('refuse un fichier qui n-est pas une image', async () => {
    const owner = await createUser();
    const group = await createGroup(owner.accessToken);

    const res = await sendImage(
      owner.accessToken,
      group.id,
      Buffer.from('pas une image'),
      'virus.txt',
      'text/plain'
    );

    expect(res.status).toBe(400);
  });

  it('refuse une image de plus de 2 Mo', async () => {
    const owner = await createUser();
    const group = await createGroup(owner.accessToken);

    const res = await sendImage(owner.accessToken, group.id, Buffer.alloc(3 * 1024 * 1024));

    expect(res.status).toBe(400);
  });

  it('refuse un non-membre', async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const group = await createGroup(owner.accessToken, { accessType: 'private' });

    expect((await sendImage(outsider.accessToken, group.id, PNG)).status).toBe(404);
  });

  it('efface reellement l-objet stocke a la suppression du message', async () => {
    const owner = await createUser();
    const group = await createGroup(owner.accessToken);
    const sent = await sendImage(owner.accessToken, group.id, PNG);
    const url = sent.body.imageUrl;

    expect((await api().get(url)).status).toBe(200);

    await api()
      .delete(`/api/groups/${group.id}/messages/${sent.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    // GET /api/media/:key est public : ne retirer que la reference laisserait
    // l'image accessible pour toujours a qui en a vu l'URL.
    expect((await api().get(url)).status).toBe(404);
  });
});

describe('Chat de groupe — cycle de vie', () => {
  it('conserve les messages d-un compte supprime, sans son identite', async () => {
    const owner = await createUser();
    const leaver = await createUser();
    const group = await createGroup(owner.accessToken);
    await join(owner.accessToken, group.id, leaver.accessToken);

    await send(leaver.accessToken, group.id, { body: 'je reste au fil' });

    await api()
      .delete('/api/users/me')
      .set('Authorization', `Bearer ${leaver.accessToken}`)
      .send({});

    const res = await list(owner.accessToken, group.id);

    // La suppression de compte est une anonymisation (migration 0003) : le
    // message survit, prive de l'identite. Les clients affichent
    // « Compte supprime » via leur displayName().
    expect(res.body.messages).toHaveLength(1);
    expect(res.body.messages[0].body).toBe('je reste au fil');
    expect(res.body.messages[0].author.firstName).toBeNull();
  });

  it('emporte les messages avec le groupe supprime', async () => {
    const owner = await createUser();
    const group = await createGroup(owner.accessToken);
    await send(owner.accessToken, group.id, { body: 'ephemere' });

    await api()
      .delete(`/api/groups/${group.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect((await list(owner.accessToken, group.id)).status).toBe(404);
  });
});
