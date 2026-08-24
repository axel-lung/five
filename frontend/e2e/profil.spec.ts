import { test, expect } from '@playwright/test';
import { account, expectHealthy, register, watchErrors } from './helpers';

/** Lot 11 : profil, disponibilites, verification d'email, export et effacement. */
test('edite son profil et ses disponibilites', async ({ page }) => {
  const errors = watchErrors(page);
  await register(page, account('Lucas'));

  await page.goto('/profil');
  await page.fill('#city', 'Reims');
  await page.fill('#preferredPosition', 'Attaquant');
  await page.selectOption('#selfDeclaredLevel', '4');
  await page.getByRole('button', { name: 'Mardi soir' }).click();
  await page.getByRole('button', { name: 'Jeudi soir' }).click();
  await page.fill('#travelRadiusKm', '20');
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(page.getByText('Profil enregistré')).toBeVisible();
  await expectHealthy(page, errors);

  // Les valeurs doivent survivre a un rechargement : elles sont en base, pas
  // seulement dans l'etat React.
  await page.reload();
  await expect(page.locator('#city')).toHaveValue('Reims');
  await expect(page.locator('#travelRadiusKm')).toHaveValue('20');
  await expect(page.getByRole('button', { name: 'Mardi soir' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
});

test('verifie son adresse email', async ({ page }) => {
  await register(page, account('Yanis'));

  await page.goto('/profil');
  await expect(page.getByText('Non vérifiée')).toBeVisible();

  await page.getByRole('button', { name: 'Vérifier' }).click();
  await expect(page.getByText('Email de vérification envoyé')).toBeVisible();

  // Hors production, l'API renvoie le jeton : l'ecran affiche le lien direct.
  await page.getByRole('link', { name: /\/verifier-email\// }).click();
  await expect(page.getByText('Votre adresse email est vérifiée')).toBeVisible();

  await page.goto('/profil');
  await expect(page.getByText('Vérifiée')).toBeVisible();
});

test('exporte ses donnees', async ({ page }) => {
  await register(page, account('Karim'));

  await page.goto('/profil/donnees');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Télécharger mes données' }).click();

  expect((await download).suggestedFilename()).toMatch(/^five-mes-donnees-\d{4}-\d{2}-\d{2}\.json$/);
});

test('supprime son compte, saisie de confirmation exigee', async ({ page }) => {
  const who = account('Iacob');
  await register(page, who);

  await page.goto('/profil/donnees');
  const remove = page.getByRole('button', { name: 'Supprimer définitivement mon compte' });

  // Un clic seul ne doit pas suffire pour une action irreversible.
  await expect(remove).toBeDisabled();
  await page.fill('#confirmation', 'supprimer');
  await expect(remove).toBeDisabled();

  await page.fill('#confirmation', 'SUPPRIMER');
  await expect(remove).toBeEnabled();
  await remove.click();

  await page.waitForURL('http://localhost:3000/');

  // Le compte efface ne doit plus pouvoir se reconnecter.
  await page.goto('/login');
  await page.fill('#email', who.email);
  await page.fill('#password', who.password);
  await page.click('button[type=submit]');
  await expect(page.getByText('Invalid email or password')).toBeVisible();
});
