import { test, expect } from '@playwright/test';
import { account, createEvent, expectHealthy, register, watchErrors } from './helpers';

/** Deux joueurs inscrits a la meme session : le point de contact le plus courant. */
const twoPlayers = async (browser: any) => {
  const organizerCtx = await browser.newContext();
  const organizer = await organizerCtx.newPage();
  const organizerAccount = account('Sebastien');
  await register(organizer, organizerAccount);
  const eventUrl = await createEvent(organizer, { title: 'Five du mardi', capacity: 8 });

  const playerCtx = await browser.newContext();
  const player = await playerCtx.newPage();
  await register(player, account('Lucas'));
  await player.goto(eventUrl);
  await player.getByRole('button', { name: 'Je participe' }).click();
  await expect(player.getByText('Votre place est confirmée')).toBeVisible();

  const playerId = await player.evaluate(() => JSON.parse(localStorage.getItem('user')!).id);

  return { organizerCtx, organizer, playerCtx, player, eventUrl, playerId };
};

test('consulte le profil public d-un participant', async ({ browser }) => {
  const { organizerCtx, organizer, playerCtx, player, eventUrl } = await twoPlayers(browser);
  const errors = watchErrors(organizer);

  await player.goto('/profil');
  await player.fill('#city', 'Reims');
  await player.fill('#preferredPosition', 'Gardien');
  await player.selectOption('#selfDeclaredLevel', '3');
  await player.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(player.getByText('Profil enregistré')).toBeVisible();

  await organizer.goto(eventUrl);
  await organizer.getByRole('link', { name: 'Lucas' }).click();
  await organizer.waitForURL(/\/joueurs\/[0-9a-f-]{36}/);

  await expect(organizer.getByRole('heading', { name: 'Lucas' })).toBeVisible();
  await expect(organizer.getByText('Gardien')).toBeVisible();
  await expect(organizer.getByText('3 / 5')).toBeVisible();

  // C-04 : rien de personnel ne doit fuir vers un autre joueur.
  const body = await organizer.textContent('body');
  expect(body).not.toContain('@example.com');
  await expectHealthy(organizer, errors);

  for (const ctx of [organizerCtx, playerCtx]) await ctx.close();
});

test('bloque un joueur, qui ne peut alors plus rejoindre ses sessions', async ({ browser }) => {
  const { organizerCtx, organizer, playerCtx, player, playerId } = await twoPlayers(browser);

  organizer.on('dialog', (d) => d.accept());
  await organizer.goto(`/joueurs/${playerId}`);
  await organizer.getByRole('button', { name: 'Bloquer ce joueur' }).click();
  await expect(organizer.getByText('Joueur bloqué')).toBeVisible();

  // D-06 empeche le contact, pas la consultation : le joueur bloque voit
  // encore une session sans groupe, mais ne peut plus s'y inscrire.
  const newEvent = await createEvent(organizer, { title: 'Five prive', capacity: 5 });
  await player.goto(newEvent);
  await player.getByRole('button', { name: 'Je participe' }).click();
  await expect(player.getByText("Cette session n'est plus disponible.")).toBeVisible();

  // Et le profil devient mutuellement invisible.
  await player.goto(`/joueurs/${await organizer.evaluate(() => JSON.parse(localStorage.getItem('user')!).id)}`);
  await expect(player.getByText(/introuvable|not found/i)).toBeVisible();

  for (const ctx of [organizerCtx, playerCtx]) await ctx.close();
});

test('liste et leve un blocage', async ({ browser }) => {
  const { organizerCtx, organizer, playerCtx, playerId } = await twoPlayers(browser);
  const errors = watchErrors(organizer);

  organizer.on('dialog', (d) => d.accept());
  await organizer.goto(`/joueurs/${playerId}`);
  await organizer.getByRole('button', { name: 'Bloquer ce joueur' }).click();
  await expect(organizer.getByText('Joueur bloqué')).toBeVisible();

  await organizer.goto('/profil/blocages');
  await expect(organizer.getByText('Lucas')).toBeVisible();
  await expectHealthy(organizer, errors);

  await organizer.getByRole('button', { name: 'Débloquer' }).click();
  await expect(organizer.getByText("Vous n'avez bloqué personne.")).toBeVisible();

  for (const ctx of [organizerCtx, playerCtx]) await ctx.close();
});

test('signale un joueur', async ({ browser }) => {
  const { organizerCtx, organizer, playerCtx, playerId } = await twoPlayers(browser);

  await organizer.goto(`/joueurs/${playerId}`);
  await organizer.getByRole('button', { name: 'Signaler ce joueur' }).click();
  await organizer.selectOption('#reportReason', 'harcelement');
  await organizer.fill('#reportDetails', 'Insultes pendant la session.');
  await organizer.getByRole('button', { name: 'Envoyer' }).click();

  await expect(organizer.getByText('Signalement transmis')).toBeVisible();

  for (const ctx of [organizerCtx, playerCtx]) await ctx.close();
});

test('signale une session', async ({ browser }) => {
  const { organizerCtx, playerCtx, player, eventUrl } = await twoPlayers(browser);
  const errors = watchErrors(player);

  await player.goto(eventUrl);
  await player.getByRole('button', { name: 'Signaler cette session' }).click();
  await player.selectOption('#reportReason', 'contenu-inapproprie');
  await player.getByRole('button', { name: 'Envoyer' }).click();

  await expect(player.getByText('Signalement transmis')).toBeVisible();
  await expectHealthy(player, errors);

  for (const ctx of [organizerCtx, playerCtx]) await ctx.close();
});
