import { test, expect } from '@playwright/test';
import { account, createEvent, expectHealthy, makeAdmin, register, watchErrors } from './helpers';

/**
 * Beta : declaration d'anomalie par un testeur, suivi par l'equipe.
 */
test('declare une anomalie depuis l-ecran fautif, et la retrouve au back-office', async ({
  browser,
}) => {
  const testerCtx = await browser.newContext();
  const tester = await testerCtx.newPage();
  const errors = watchErrors(tester);
  await register(tester, account('Lucas'));

  // On declare depuis une fiche session : c'est l'URL de cet ecran qui doit
  // partir avec le rapport, pas celle d'un formulaire dedie.
  const eventUrl = await createEvent(tester, { title: 'Five du mardi', capacity: 10 });

  await tester.getByRole('button', { name: 'Déclarer une anomalie' }).click();
  await tester.selectOption('#bugKind', 'display');
  await tester.selectOption('#bugSeverity', 'blocking');
  await tester.fill('#bugDescription', "Le bouton « Je participe » ne repond pas au clic.");
  await tester.getByRole('button', { name: 'Envoyer' }).click();

  await expect(tester.getByText('Merci, l’anomalie est transmise')).toBeVisible();
  await expectHealthy(tester, errors);

  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  const who = account('Admin');
  await register(adminPage, who);
  await makeAdmin(who.email);
  await adminPage.reload();

  await adminPage.goto('/admin/anomalies');
  await expect(adminPage.getByText('Affichage', { exact: true })).toBeVisible();
  await expect(adminPage.getByText('Bloquant', { exact: true })).toBeVisible();
  await expect(adminPage.getByText(/ne repond pas au clic/)).toBeVisible();
  // Le contexte capture en silence : l'ecran d'ou part la declaration.
  await expect(adminPage.getByText(new URL(eventUrl).pathname)).toBeVisible();

  await adminPage.getByLabel('Note de traitement').fill('Corrigé en 1.0.1.');
  await adminPage.getByRole('button', { name: 'Corrigée' }).click();
  await expect(adminPage.getByText('Aucune anomalie dans cette catégorie.')).toBeVisible();

  await adminPage.selectOption('#bugStatusFilter', 'fixed');
  await expect(adminPage.getByText('Note : Corrigé en 1.0.1.')).toBeVisible();

  for (const ctx of [testerCtx, adminCtx]) await ctx.close();
});

test('le bouton reste joignable sur les ecrans connectes et s-annule sans envoi', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await register(page, account('Yanis'));

  const opener = page.getByRole('button', { name: 'Déclarer une anomalie' });

  for (const path of ['/dashboard', '/groupes', '/profil']) {
    await page.goto(path);
    await expect(opener).toBeVisible();
  }

  await opener.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Le bouton flottant ne doit pas faire deborder la page ni masquer la
  // barre d'onglets.
  await expectHealthy(page, errors);
  await expect(page.getByRole('link', { name: 'Profil' })).toBeVisible();
});
