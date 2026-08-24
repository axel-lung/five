import { test, expect } from '@playwright/test';
import { account, createEvent, createGroup, expectHealthy, register, watchErrors } from './helpers';

/** Lot 12 : centre de notifications, badge, preferences et relance N-03. */
test('previent le promu quand une place se libere, et compte la non-lue', async ({ browser }) => {
  const organizerCtx = await browser.newContext();
  const organizer = await organizerCtx.newPage();
  await register(organizer, account('Sebastien'));
  const eventUrl = await createEvent(organizer, { title: 'Five du mardi', capacity: 1 });

  const firstCtx = await browser.newContext();
  const first = await firstCtx.newPage();
  await register(first, account('Lucas'));
  await first.goto(eventUrl);
  await first.getByRole('button', { name: 'Je participe' }).click();
  await expect(first.getByText('Votre place est confirmée')).toBeVisible();

  const secondCtx = await browser.newContext();
  const second = await secondCtx.newPage();
  const errors = watchErrors(second);
  await register(second, account('Yanis'));
  await second.goto(eventUrl);
  await second.getByRole('button', { name: "Rejoindre la liste d'attente" }).click();

  // Le desistement du confirme promeut le suivant et doit le notifier.
  await first.getByRole('button', { name: 'Me désister' }).click();
  await expect(first.getByText("liste d'attente prend votre place")).toBeVisible();

  await second.goto('/notifications');
  await expect(second.getByText(/Une place s'est libérée pour Five du mardi/)).toBeVisible();
  await expect(second.getByText('1 non lue')).toBeVisible();
  await expectHealthy(second, errors);

  // Le badge de la navigation reprend le meme compteur.
  await expect(second.getByLabel('1 non lues')).toBeVisible();

  // Cliquer la notification la marque lue et mene a la session.
  await second.getByText(/Une place s'est libérée/).click();
  await second.waitForURL(/\/sessions\/[0-9a-f-]{36}/);

  await second.goto('/notifications');
  await expect(second.getByText('Tout est lu.')).toBeVisible();

  for (const ctx of [organizerCtx, firstCtx, secondCtx]) await ctx.close();
});

test('previent les inscrits d-une annulation, et tout marquer comme lu', async ({ browser }) => {
  const organizerCtx = await browser.newContext();
  const organizer = await organizerCtx.newPage();
  await register(organizer, account('Sebastien'));
  const eventUrl = await createEvent(organizer, { title: 'Five annulé', capacity: 5 });

  const playerCtx = await browser.newContext();
  const player = await playerCtx.newPage();
  await register(player, account('Karim'));
  await player.goto(eventUrl);
  await player.getByRole('button', { name: 'Je participe' }).click();
  await expect(player.getByText('Votre place est confirmée')).toBeVisible();

  organizer.on('dialog', (d) => d.accept());
  await organizer.goto(eventUrl);
  await organizer.getByRole('button', { name: 'Annuler la session' }).click();
  await expect(organizer.getByText('Annulé')).toBeVisible();

  await player.goto('/notifications');
  await expect(player.getByText(/Five annulé a été annulée/)).toBeVisible();

  await player.getByRole('button', { name: 'Tout marquer comme lu' }).click();
  await expect(player.getByText('Tout est lu.')).toBeVisible();

  // Le filtre ne doit alors plus rien montrer.
  await player.getByRole('button', { name: 'Non lues seulement' }).click();
  await expect(player.getByText('Aucune notification non lue.')).toBeVisible();

  for (const ctx of [organizerCtx, playerCtx]) await ctx.close();
});

test('enregistre les preferences et les heures de silence', async ({ page }) => {
  const errors = watchErrors(page);
  await register(page, account('Iacob'));

  await page.goto('/notifications/preferences');
  await page.uncheck('#emailEnabled');
  await page.selectOption('#quietHoursStart', '22');
  await page.selectOption('#quietHoursEnd', '8');
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(page.getByText('Préférences enregistrées')).toBeVisible();
  await expectHealthy(page, errors);

  await page.reload();
  await expect(page.locator('#emailEnabled')).not.toBeChecked();
  await expect(page.locator('#quietHoursStart')).toHaveValue('22');
});

test('relance les non-repondants, une seule fois par jour', async ({ browser }) => {
  const ownerCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  await register(owner, account('Sebastien'));
  const groupUrl = await createGroup(owner, 'Les Rémois');

  await owner.getByRole('button', { name: "Générer un lien d'invitation" }).click();
  const inviteToken = await owner.evaluate(async () => {
    const id = window.location.pathname.split('/').pop();
    const res = await fetch(`http://localhost:3001/api/groups/${id}/invitations`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
    });
    return (await res.json())[0].token;
  });

  const silentCtx = await browser.newContext();
  const silent = await silentCtx.newPage();
  await register(silent, account('Yanis'));
  await silent.goto(`/invitation/${inviteToken}`);
  await silent.getByRole('button', { name: 'Rejoindre le groupe' }).click();
  await silent.waitForURL(groupUrl);

  // Session rattachee au groupe : la relance ne vise que ses membres.
  await owner.goto('/sessions/nouvelle');
  await owner.fill('#title', 'Five du mardi');
  await owner.fill('#dateTime', '2027-03-09T19:00');
  await owner.selectOption('#groupId', { label: 'Les Rémois' });
  await owner.click('button[type=submit]');
  await owner.waitForURL(/\/sessions\/[0-9a-f-]{36}/);

  await owner.getByRole('button', { name: 'Relancer les non-répondants' }).click();
  await expect(owner.getByText('Relance envoyée à 1 joueur')).toBeVisible();

  await silent.goto('/notifications');
  await expect(silent.getByText(/l'organisateur attend votre réponse/)).toBeVisible();

  // Le plafond quotidien est une regle du produit, pas une panne.
  await owner.getByRole('button', { name: 'Relancer les non-répondants' }).click();
  await expect(owner.getByText(/déjà été envoyée aujourd'hui/)).toBeVisible();

  for (const ctx of [ownerCtx, silentCtx]) await ctx.close();
});
