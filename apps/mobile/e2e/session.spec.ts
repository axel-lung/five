import { test, expect, Page } from '@playwright/test';
import { account, expectHealthy, register, watchErrors } from './helpers';

/** Cree une session et renvoie son URL. */
const createEvent = async (
  page: Page,
  fields: { title: string; dateTime?: string; capacity?: number; location?: string }
) => {
  await page.goto('/sessions/nouvelle');
  await page.getByTestId('create-event-title').fill(fields.title);
  await page.getByTestId('create-event-datetime').fill(fields.dateTime ?? '2027-03-09 19:00');
  if (fields.location) await page.getByTestId('create-event-location').fill(fields.location);
  await page.getByTestId('create-event-capacity').fill(String(fields.capacity ?? 10));
  await page.getByTestId('create-event-submit').click();
  await page.waitForURL(/\/sessions\/[0-9a-f-]{36}/);
  return page.url();
};

/** Lot B : ce que l'organisateur peut faire de sa session. */
test('refuse une date illisible au lieu de planter', async ({ page }) => {
  const errors = watchErrors(page);
  await register(page, account('Sebastien'));

  await page.goto('/sessions/nouvelle');
  await page.getByTestId('create-event-title').fill('Five du mardi');
  await page.getByTestId('create-event-datetime').fill('mardi prochain');
  await page.getByTestId('create-event-submit').click();

  await expect(page.getByText('Date invalide')).toBeVisible();
  // Le point du test : l'ecran reste vivant, il n'a pas leve sur toISOString.
  await expectHealthy(page, errors);
});

test('modifie une session', async ({ page }) => {
  const errors = watchErrors(page);
  await register(page, account('Sebastien'));
  await createEvent(page, { title: 'Five du mardi', capacity: 8 });

  await page.getByTestId('event-edit').click();
  await page.getByTestId('event-edit-location').fill('Urban Soccer');
  await page.getByTestId('event-edit-datetime').fill('2027-03-16 20:30');
  await page.getByTestId('event-edit-save').click();

  await expect(page.getByText('Session mise à jour.')).toBeVisible();
  await expect(page.getByText('Urban Soccer')).toBeVisible();
  await expectHealthy(page, errors);
});

test('duplique une session, la copie naissant en brouillon et sans inscrits', async ({ browser }) => {
  const organizerCtx = await browser.newContext();
  const organizer = await organizerCtx.newPage();
  await register(organizer, account('Sebastien'));
  const eventUrl = await createEvent(organizer, {
    title: 'Five hebdo',
    capacity: 12,
    location: 'Le Five Reims',
  });

  const playerCtx = await browser.newContext();
  const player = await playerCtx.newPage();
  await register(player, account('Lucas'));
  await player.goto(eventUrl);
  await player.getByTestId('event-join').click();
  await expect(player.getByText('Votre place est confirmée.')).toBeVisible();

  await organizer.goto(eventUrl);
  await organizer.getByTestId('event-duplicate-date').fill('2027-03-16 19:00');
  await organizer.getByTestId('event-duplicate').click();

  // Attendre un motif d'URL ne suffit pas : on est deja sur une page session.
  await organizer.waitForURL((url) => url.toString() !== eventUrl);

  await expect(organizer.getByText('Five hebdo')).toBeVisible();
  await expect(organizer.getByText('Brouillon', { exact: true })).toBeVisible();
  await expect(organizer.getByText('Le Five Reims')).toBeVisible();
  await expect(organizer.getByText('Confirmés (0)')).toBeVisible();

  for (const ctx of [organizerCtx, playerCtx]) await ctx.close();
});

test('ouvre un brouillon puis le termine', async ({ page }) => {
  await register(page, account('Sebastien'));
  const eventUrl = await createEvent(page, { title: 'Five hebdo', capacity: 6 });

  await page.getByTestId('event-duplicate-date').fill('2027-04-06 19:00');
  await page.getByTestId('event-duplicate').click();
  await page.waitForURL((url) => url.toString() !== eventUrl);
  await expect(page.getByText('Brouillon', { exact: true })).toBeVisible();

  await page.getByText('Ouvrir aux inscriptions').click();
  await expect(page.getByText('Ouvert', { exact: true })).toBeVisible();

  page.on('dialog', (d) => d.accept());
  await page.getByTestId('event-complete').click();
  await expect(page.getByText('Terminé', { exact: true })).toBeVisible();
});

test('annule une session, et les inscrits sont prevenus', async ({ browser }) => {
  const organizerCtx = await browser.newContext();
  const organizer = await organizerCtx.newPage();
  await register(organizer, account('Sebastien'));
  const eventUrl = await createEvent(organizer, { title: 'Five annulé', capacity: 5 });

  const playerCtx = await browser.newContext();
  const player = await playerCtx.newPage();
  await register(player, account('Lucas'));
  await player.goto(eventUrl);
  await player.getByTestId('event-join').click();
  await expect(player.getByText('Votre place est confirmée.')).toBeVisible();

  organizer.on('dialog', (d) => d.accept());
  await organizer.goto(eventUrl);
  await organizer.getByTestId('event-cancel').click();
  await expect(organizer.getByText('Annulé', { exact: true })).toBeVisible();

  await player.goto('/notifications');
  await expect(player.getByText(/Five annulé a été annulée/)).toBeVisible();

  for (const ctx of [organizerCtx, playerCtx]) await ctx.close();
});

test('supprime une session', async ({ page }) => {
  await register(page, account('Sebastien'));
  const eventUrl = await createEvent(page, { title: 'Five a supprimer', capacity: 5 });

  page.on('dialog', (d) => d.accept());
  await page.getByTestId('event-delete').click();
  await page.waitForURL('**/dashboard');

  // On verifie la disparition cote API plutot qu'a l'ecran : le layout est un
  // navigateur a onglets, et l'export web ne masque pas l'onglet quitte — les
  // deux ecrans restent visibles en meme temps. Sur natif react-navigation
  // masque l'inactif, mais la suite doit rester fiable ici.
  const status = await page.evaluate(async (url) => {
    const id = url.split('/').pop();
    const res = await fetch(`http://localhost:3001/api/events/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
    });
    return res.status;
  }, eventUrl);

  expect(status).toBe(404);
});

test('un joueur ne voit aucune action d-organisation, mais peut signaler', async ({ browser }) => {
  const organizerCtx = await browser.newContext();
  const organizer = await organizerCtx.newPage();
  await register(organizer, account('Sebastien'));
  const eventUrl = await createEvent(organizer, { title: 'Five du mardi', capacity: 8 });

  const playerCtx = await browser.newContext();
  const player = await playerCtx.newPage();
  const errors = watchErrors(player);
  await register(player, account('Lucas'));
  await player.goto(eventUrl);

  await expect(player.getByTestId('event-edit')).toHaveCount(0);
  await expect(player.getByTestId('event-delete')).toHaveCount(0);
  await expect(player.getByTestId('event-cancel')).toHaveCount(0);
  await expect(player.getByTestId('event-join')).toBeVisible();
  await expect(player.getByTestId('report-open')).toBeVisible();
  await expectHealthy(player, errors);

  for (const ctx of [organizerCtx, playerCtx]) await ctx.close();
});
