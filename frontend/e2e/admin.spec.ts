import { test, expect } from '@playwright/test';
import { account, createEvent, expectHealthy, makeAdmin, register, watchErrors } from './helpers';

/** Cree un compte, le promeut administrateur, et recharge sa session. */
const admin = async (page: any) => {
  const who = account('Admin');
  await register(page, who);
  await makeAdmin(who.email);
  // Le role est relu en base a chaque appel : un rechargement suffit, sans
  // nouvelle connexion ni nouveau jeton.
  await page.reload();
  return who;
};

test('un compte ordinaire ne voit ni l-onglet ni les ecrans admin', async ({ page }) => {
  const errors = watchErrors(page);
  await register(page, account('Lucas'));

  await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);

  // Le garde client renvoie au tableau de bord ; le serveur repond 404 de
  // toute facon.
  await page.goto('/admin');
  await page.waitForURL('**/dashboard');
  await expectHealthy(page, errors);
});

test('le tableau de bord affiche les volumes', async ({ page }) => {
  const errors = watchErrors(page);
  await admin(page);

  await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible();
  await page.getByRole('link', { name: 'Admin' }).click();
  await page.waitForURL('**/admin');

  await expect(page.getByRole('heading', { name: 'Back-office' })).toBeVisible();
  await expect(page.getByText('Comptes actifs')).toBeVisible();
  await expect(page.getByText('Sessions à venir')).toBeVisible();
  await expectHealthy(page, errors);
});

test('traite un signalement et le retire de la file', async ({ browser }) => {
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await admin(adminPage);

  // Deux joueurs, dont l'un signale l'autre.
  const reporterCtx = await browser.newContext();
  const reporter = await reporterCtx.newPage();
  await register(reporter, account('Lucas'));
  const eventUrl = await createEvent(reporter, { title: 'Five du mardi', capacity: 5 });

  const targetCtx = await browser.newContext();
  const target = await targetCtx.newPage();
  await register(target, account('Yanis'));
  await target.goto(eventUrl);
  await target.getByRole('button', { name: 'Je participe' }).click();
  await expect(target.getByText('Votre place est confirmée')).toBeVisible();

  const targetId = await target.evaluate(() => JSON.parse(localStorage.getItem('user')!).id);
  await reporter.goto(`/joueurs/${targetId}`);
  await reporter.getByRole('button', { name: 'Signaler ce joueur' }).click();
  await reporter.selectOption('#reportReason', 'spam');
  await reporter.getByRole('button', { name: 'Envoyer' }).click();
  await expect(reporter.getByText('Signalement transmis')).toBeVisible();

  await adminPage.goto('/admin/signalements');
  await expect(adminPage.getByText('Joueur — spam')).toBeVisible();

  await adminPage.getByLabel('Note de traitement').fill('Compte averti.');
  await adminPage.getByRole('button', { name: 'Traiter' }).click();
  await expect(adminPage.getByText('Aucun signalement dans cette catégorie.')).toBeVisible();

  // Il reapparait dans la categorie traitee, avec sa note.
  await adminPage.selectOption('#statusFilter', 'resolved');
  await expect(adminPage.getByText('Note : Compte averti.')).toBeVisible();

  for (const ctx of [adminCtx, reporterCtx, targetCtx]) await ctx.close();
});

test('recherche un compte, le suspend, puis leve la suspension', async ({ browser }) => {
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await admin(adminPage);

  const playerCtx = await browser.newContext();
  const player = await playerCtx.newPage();
  const playerAccount = account('Karim');
  await register(player, playerAccount);

  adminPage.on('dialog', (d) => d.accept('Comportement abusif'));

  await adminPage.goto('/admin/comptes');
  await adminPage.getByLabel('Rechercher un compte').fill(playerAccount.email);
  await adminPage.getByRole('button', { name: 'Chercher' }).click();
  await expect(adminPage.getByText(playerAccount.email)).toBeVisible();

  await adminPage.getByRole('button', { name: 'Suspendre' }).click();
  await expect(adminPage.getByText('Compte suspendu')).toBeVisible();
  await expect(adminPage.getByText('Suspendu', { exact: true })).toBeVisible();

  // B-02 : le compte suspendu ne peut plus se connecter, et sait pourquoi.
  const suspendedCtx = await browser.newContext();
  const suspended = await suspendedCtx.newPage();
  await suspended.goto('/login');
  await suspended.fill('#email', playerAccount.email);
  await suspended.fill('#password', playerAccount.password);
  await suspended.click('button[type=submit]');
  await expect(suspended.getByText(/Comportement abusif/)).toBeVisible();

  await adminPage.getByRole('button', { name: 'Lever la suspension' }).click();
  await expect(adminPage.getByText('Suspension levée')).toBeVisible();

  for (const ctx of [adminCtx, playerCtx, suspendedCtx]) await ctx.close();
});

test('journalise les actions sensibles', async ({ browser }) => {
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  const errors = watchErrors(adminPage);
  await admin(adminPage);

  const playerCtx = await browser.newContext();
  const player = await playerCtx.newPage();
  const playerAccount = account('Karim');
  await register(player, playerAccount);

  adminPage.on('dialog', (d) => d.accept('Triche'));

  await adminPage.goto('/admin/comptes');
  await adminPage.getByLabel('Rechercher un compte').fill(playerAccount.email);
  await adminPage.getByRole('button', { name: 'Chercher' }).click();
  await adminPage.getByRole('button', { name: 'Suspendre' }).click();
  await expect(adminPage.getByText('Compte suspendu')).toBeVisible();

  await adminPage.goto('/admin/journal');
  await adminPage.selectOption('#actionFilter', 'admin.user.suspend');
  // La base est partagee par toute la suite : d'autres suspensions peuvent
  // deja figurer au journal. On ancre donc sur le motif propre a ce test.
  await expect(adminPage.getByRole('paragraph').filter({ hasText: /^Suspension$/ }).first()).toBeVisible();
  await expect(adminPage.getByText(/Triche/)).toBeVisible();
  await expectHealthy(adminPage, errors);

  for (const ctx of [adminCtx, playerCtx]) await ctx.close();
});

test('reference un complexe, qui devient selectionnable a la creation', async ({ browser }) => {
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await admin(adminPage);

  await adminPage.goto('/admin/complexes');
  await adminPage.fill('#venueName', 'Le Five Reims');
  await adminPage.fill('#venueCity', 'Reims');
  await adminPage.check('#isPartner');
  await adminPage.getByRole('button', { name: 'Référencer' }).click();

  await expect(adminPage.getByText('Complexe référencé.', { exact: true })).toBeVisible();
  await expect(adminPage.getByText('Partenaire', { exact: true })).toBeVisible();

  // PA-03 : le catalogue est lisible par tout compte connecte.
  const playerCtx = await browser.newContext();
  const player = await playerCtx.newPage();
  await register(player, account('Lucas'));
  await player.goto('/sessions/nouvelle');
  await expect(player.locator('#venueId')).toBeVisible();
  await player.selectOption('#venueId', { label: 'Le Five Reims — Reims' });

  await player.fill('#title', 'Five du mardi');
  await player.fill('#dateTime', '2027-03-09T19:00');
  await player.click('button[type=submit]');
  await player.waitForURL(/\/sessions\/[0-9a-f-]{36}/);
  await expect(player.getByText('Le Five Reims')).toBeVisible();

  for (const ctx of [adminCtx, playerCtx]) await ctx.close();
});
