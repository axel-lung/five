import { test, expect } from '@playwright/test';
import { account, createEvent, expectHealthy, register, watchErrors } from './helpers';

/** Lot 14 : edition, statuts, duplication et suppression d'une session. */
test('modifie une session, et les inscrits sont prevenus du changement', async ({ browser }) => {
  const organizerCtx = await browser.newContext();
  const organizer = await organizerCtx.newPage();
  const errors = watchErrors(organizer);
  await register(organizer, account('Sebastien'));
  const eventUrl = await createEvent(organizer, { title: 'Five du mardi', capacity: 8 });

  const playerCtx = await browser.newContext();
  const player = await playerCtx.newPage();
  await register(player, account('Lucas'));
  await player.goto(eventUrl);
  await player.getByRole('button', { name: 'Je participe' }).click();
  await expect(player.getByText('Votre place est confirmée')).toBeVisible();

  await organizer.goto(eventUrl);
  await organizer.getByRole('button', { name: 'Modifier la session' }).click();
  await organizer.fill('#editDateTime', '2027-03-16T20:30');
  await organizer.fill('#editLocation', 'Urban Soccer');
  await organizer.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(organizer.getByText('Session mise à jour')).toBeVisible();
  await expect(organizer.getByText('Urban Soccer')).toBeVisible();
  await expectHealthy(organizer, errors);

  // N-01 : un changement d'horaire notifie les inscrits.
  await player.goto('/notifications');
  await expect(player.getByText(/a changé d'horaire ou de lieu/)).toBeVisible();

  for (const ctx of [organizerCtx, playerCtx]) await ctx.close();
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
  await player.getByRole('button', { name: 'Je participe' }).click();
  await expect(player.getByText('Votre place est confirmée')).toBeVisible();

  await organizer.goto(eventUrl);
  await organizer.fill('#duplicateDate', '2027-03-16T19:00');
  await organizer.getByRole('button', { name: 'Dupliquer la session' }).click();

  // Attendre un motif d'URL ne suffit pas : on est deja sur une page session,
  // et le motif matcherait immediatement. On attend un changement d'URL.
  await organizer.waitForURL((url) => url.toString() !== eventUrl);

  await expect(organizer.getByRole('heading', { name: 'Five hebdo' })).toBeVisible();
  await expect(organizer.getByText('Brouillon', { exact: true })).toBeVisible();
  await expect(organizer.getByText('Le Five Reims')).toBeVisible();
  await expect(organizer.getByText('Confirmés (0)')).toBeVisible();

  for (const ctx of [organizerCtx, playerCtx]) await ctx.close();
});

test('ouvre un brouillon aux inscriptions puis le termine', async ({ page }) => {
  await register(page, account('Sebastien'));
  const eventUrl = await createEvent(page, { title: 'Five hebdo', capacity: 6 });

  await page.fill('#duplicateDate', '2027-04-06T19:00');
  await page.getByRole('button', { name: 'Dupliquer la session' }).click();
  await page.waitForURL((url) => url.toString() !== eventUrl);
  await expect(page.getByText('Brouillon', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Ouvrir aux inscriptions' }).click();
  await expect(page.getByText('Ouvert', { exact: true })).toBeVisible();

  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Marquer comme terminée' }).click();
  await expect(page.getByText('Terminé', { exact: true })).toBeVisible();

  // Une session terminee ne se rejoint plus.
  await expect(page.getByRole('button', { name: 'Je participe' })).toHaveCount(0);
});

test('supprime une session', async ({ page }) => {
  await register(page, account('Sebastien'));
  await createEvent(page, { title: 'Five a supprimer', capacity: 5 });

  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Supprimer la session' }).click();

  await page.waitForURL('**/dashboard');
  await expect(page.getByText('Five a supprimer')).toHaveCount(0);
});

/**
 * E-03 : l'organisateur ne part pas sans laisser la session a quelqu'un.
 * Sans cette regle, elle resterait ouverte sans personne pour la modifier,
 * la relancer ni l'annuler.
 */
test('lègue la session avant de la quitter', async ({ browser }) => {
  const organizerCtx = await browser.newContext();
  const organizer = await organizerCtx.newPage();
  const errors = watchErrors(organizer);
  await register(organizer, account('Sebastien'));
  const eventUrl = await createEvent(organizer, { title: 'Five du mardi', capacity: 8 });

  const playerCtx = await browser.newContext();
  const player = await playerCtx.newPage();
  await register(player, account('Lucas'));
  await player.goto(eventUrl);
  await player.getByRole('button', { name: 'Je participe' }).click();
  await expect(player.getByText('Votre place est confirmée')).toBeVisible();

  await organizer.goto(eventUrl);
  await organizer.getByRole('button', { name: 'Quitter la session' }).click();

  // Le depart est refuse tant qu'aucun successeur n'est designe : le panneau
  // de choix prend la place du message d'erreur.
  await expect(organizer.getByText('À qui laissez-vous la session ?')).toBeVisible();
  await organizer.selectOption('#successor', { label: 'Lucas' });
  await organizer.getByRole('button', { name: 'Transmettre et quitter' }).click();

  await expect(organizer.getByText("Lucas en est désormais l'organisateur")).toBeVisible();
  await expect(organizer.getByText('Organisation')).toHaveCount(0);
  await expectHealthy(organizer, errors);

  // Le successeur herite pour de bon : les commandes d'organisation lui sont
  // ouvertes, et sa boite de reception le lui dit.
  await player.reload();
  await expect(player.getByRole('button', { name: 'Modifier la session' })).toBeVisible();
  await player.goto('/notifications');
  await expect(player.getByText(/Vous organisez désormais Five du mardi/)).toBeVisible();

  for (const ctx of [organizerCtx, playerCtx]) await ctx.close();
});

test('transmet l-organisation sans quitter la session', async ({ browser }) => {
  const organizerCtx = await browser.newContext();
  const organizer = await organizerCtx.newPage();
  await register(organizer, account('Sebastien'));
  const eventUrl = await createEvent(organizer, { title: 'Five du jeudi', capacity: 8 });

  const playerCtx = await browser.newContext();
  const player = await playerCtx.newPage();
  await register(player, account('Lucas'));
  await player.goto(eventUrl);
  await player.getByRole('button', { name: 'Je participe' }).click();
  await expect(player.getByText('Votre place est confirmée')).toBeVisible();

  await organizer.goto(eventUrl);
  await organizer.getByRole('button', { name: "Transmettre l'organisation" }).click();
  await organizer.selectOption('#successor', { label: 'Lucas' });
  await organizer.getByRole('button', { name: 'Transmettre', exact: true }).click();

  await expect(organizer.getByText('Lucas organise désormais cette session')).toBeVisible();
  await expect(organizer.getByRole('button', { name: 'Modifier la session' })).toHaveCount(0);

  // Il a passe la main, pas rendu sa place : rien ne l'inscrit ni ne le
  // desinscrit au passage.
  await expect(organizer.getByRole('button', { name: 'Je participe' })).toBeVisible();

  for (const ctx of [organizerCtx, playerCtx]) await ctx.close();
});

test('propose la suppression a l-organisateur reste seul', async ({ page }) => {
  await register(page, account('Sebastien'));
  await createEvent(page, { title: 'Five sans personne', capacity: 5 });

  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Quitter la session' }).click();

  await page.waitForURL('**/dashboard');
  await expect(page.getByText('Five sans personne')).toHaveCount(0);
});

test('un joueur ne voit aucune action d-organisation', async ({ browser }) => {
  const organizerCtx = await browser.newContext();
  const organizer = await organizerCtx.newPage();
  await register(organizer, account('Sebastien'));
  const eventUrl = await createEvent(organizer, { title: 'Five du mardi', capacity: 8 });

  const playerCtx = await browser.newContext();
  const player = await playerCtx.newPage();
  const errors = watchErrors(player);
  await register(player, account('Lucas'));
  await player.goto(eventUrl);

  await expect(player.getByText('Organisation')).toHaveCount(0);
  await expect(player.getByRole('button', { name: 'Modifier la session' })).toHaveCount(0);
  await expect(player.getByRole('button', { name: 'Supprimer la session' })).toHaveCount(0);
  await expect(player.getByRole('button', { name: 'Quitter la session' })).toHaveCount(0);
  await expect(player.getByRole('button', { name: 'Je participe' })).toBeVisible();
  await expectHealthy(player, errors);

  for (const ctx of [organizerCtx, playerCtx]) await ctx.close();
});
