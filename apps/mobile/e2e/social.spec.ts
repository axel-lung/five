import { test, expect, Browser, Dialog, Page } from '@playwright/test';
import { account, expectHealthy, register, watchErrors } from './helpers';

const createEvent = async (page: Page, title: string, capacity = 8) => {
  await page.goto('/sessions/nouvelle');
  await page.getByTestId('create-event-title').fill(title);
  await page.getByTestId('create-event-datetime').fill('2027-03-09 19:00');
  await page.getByTestId('create-event-capacity').fill(String(capacity));
  await page.getByTestId('create-event-submit').click();
  await page.waitForURL(/\/sessions\/[0-9a-f-]{36}/);
  return page.url();
};

/** Deux joueurs inscrits a la meme session : leur point de contact le plus courant. */
const twoPlayers = async (browser: Browser) => {
  const organizerCtx = await browser.newContext();
  const organizer = await organizerCtx.newPage();
  await register(organizer, account('Sebastien'));
  const eventUrl = await createEvent(organizer, 'Five du mardi');

  const playerCtx = await browser.newContext();
  const player = await playerCtx.newPage();
  await register(player, account('Lucas'));
  await player.goto(eventUrl);
  await player.getByTestId('event-join').click();
  await expect(player.getByText('Votre place est confirmée.')).toBeVisible();

  const playerId = await player.evaluate(
    () => JSON.parse(localStorage.getItem('user')!).id as string
  );
  const organizerId = await organizer.evaluate(
    () => JSON.parse(localStorage.getItem('user')!).id as string
  );

  return { organizerCtx, organizer, organizerId, playerCtx, player, playerId, eventUrl };
};

test('consulte le profil public d-un joueur, sans donnee personnelle', async ({ browser }) => {
  const { organizerCtx, organizer, playerCtx, player, playerId } = await twoPlayers(browser);
  const errors = watchErrors(organizer);

  await player.goto('/profil');
  await player.getByTestId('profile-city').fill('Reims');
  await player.getByTestId('profile-position').fill('Gardien');
  await player.getByTestId('profile-save').click();
  await expect(player.getByText('Profil enregistré.')).toBeVisible();

  await organizer.goto(`/joueurs/${playerId}`);
  await expect(organizer.getByText('Lucas')).toBeVisible();
  await expect(organizer.getByText('Gardien')).toBeVisible();

  // C-04 : rien de personnel ne doit fuir vers un autre joueur.
  const body = await organizer.textContent('body');
  expect(body).not.toContain('@example.com');
  await expectHealthy(organizer, errors);

  for (const ctx of [organizerCtx, playerCtx]) await ctx.close();
});

test('bloque un joueur, qui ne peut alors plus rejoindre ses sessions', async ({ browser }) => {
  const { organizerCtx, organizer, playerCtx, player, playerId, organizerId } =
    await twoPlayers(browser);

  organizer.on('dialog', (d: Dialog) => d.accept());
  await organizer.goto(`/joueurs/${playerId}`);
  await organizer.getByTestId('player-block').click();
  await expect(organizer.getByText('Joueur bloqué.')).toBeVisible();

  // D-06 empeche le contact et l'inscription, pas la consultation d'une
  // session sans groupe : le joueur voit encore l'ecran, mais ne peut plus
  // s'y inscrire.
  const newEvent = await createEvent(organizer, 'Five privé', 5);
  await player.goto(newEvent);
  await player.getByTestId('event-join').click();
  // L'API repond 404 pour ne pas reveler le blocage ; l'ecran garde ce
  // silence tout en restant lisible en francais.
  await expect(player.getByText("Cette session n'est plus disponible.")).toBeVisible();

  // Le profil devient mutuellement invisible.
  await player.goto(`/joueurs/${organizerId}`);
  await expect(player.getByText(/introuvable|not found/i)).toBeVisible();

  for (const ctx of [organizerCtx, playerCtx]) await ctx.close();
});

test('liste et leve un blocage', async ({ browser }) => {
  const { organizerCtx, organizer, playerCtx, playerId } = await twoPlayers(browser);
  const errors = watchErrors(organizer);

  organizer.on('dialog', (d: Dialog) => d.accept());
  await organizer.goto(`/joueurs/${playerId}`);
  await organizer.getByTestId('player-block').click();
  await expect(organizer.getByText('Joueur bloqué.')).toBeVisible();

  await organizer.goto('/profil/blocages');
  await expect(organizer.getByText('Lucas')).toBeVisible();
  await expectHealthy(organizer, errors);

  await organizer.getByText('Débloquer').click();
  await expect(organizer.getByText("Vous n'avez bloqué personne.")).toBeVisible();

  for (const ctx of [organizerCtx, playerCtx]) await ctx.close();
});

test('signale un joueur', async ({ browser }) => {
  const { organizerCtx, organizer, playerCtx, playerId } = await twoPlayers(browser);

  await organizer.goto(`/joueurs/${playerId}`);
  await organizer.getByTestId('report-open').click();
  await organizer.getByTestId('report-details').fill('Insultes pendant la session.');
  await organizer.getByTestId('report-submit').click();

  await expect(organizer.getByText('Signalement transmis à la modération.')).toBeVisible();

  for (const ctx of [organizerCtx, playerCtx]) await ctx.close();
});

test('ne se bloque ni ne se signale soi-meme', async ({ page }) => {
  const errors = watchErrors(page);
  await register(page, account('Sebastien'));

  const myId = await page.evaluate(() => JSON.parse(localStorage.getItem('user')!).id as string);
  await page.goto(`/joueurs/${myId}`);

  await expect(page.getByTestId('player-block')).toHaveCount(0);
  await expect(page.getByTestId('report-open')).toHaveCount(0);
  await expectHealthy(page, errors);
});

// C-02 : le televersement lui-meme passe par le selecteur natif, hors de
// portee de l'export web. On verifie ici ce qui l'est : le point d'entree
// existe et remplace le message « arrive avec la prochaine version ».
test('propose le changement de photo de profil', async ({ page }) => {
  await register(page, account('Sebastien'));

  await page.goto('/profil');
  await expect(page.getByTestId('avatar-pick')).toBeVisible();
  await expect(page.getByText('arrive avec la prochaine version')).toHaveCount(0);
});
