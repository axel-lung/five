import { test, expect } from '@playwright/test';
import { account, createEvent, createGroup, expectHealthy, register, watchErrors } from './helpers';

/**
 * Les quatre parcours critiques du CCH.md 2.6.
 *
 * Ils tournent sur un vrai stack — API et PostgreSQL — en viewport telephone.
 * C'est cette suite qui a revele que le formulaire d'inscription envoyait des
 * chaines vides refusees par Joi, invisible au typecheck comme aux tests
 * unitaires du backend.
 */
test('parcours 1 — creer une session', async ({ page }) => {
  const errors = watchErrors(page);
  await register(page, account('Sebastien'));

  await createEvent(page, { title: 'Five du mardi', location: 'Le Five Reims', capacity: 2 });

  await expect(page.getByText('Five du mardi')).toBeVisible();
  await expect(page.getByText('Le Five Reims')).toBeVisible();
  await expect(page.getByText('Ouvert')).toBeVisible();
  await expectHealthy(page, errors);
});

test('parcours 4 — lien partageable consultable sans compte', async ({ page, browser }) => {
  await register(page, account('Sebastien'));
  const eventUrl = await createEvent(page, { title: 'Five du jeudi', capacity: 5 });

  const token = await page.evaluate(async (url) => {
    const id = url.split('/').pop();
    const res = await fetch(`http://localhost:3001/api/events/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
    });
    return (await res.json()).shareableLinkToken;
  }, eventUrl);

  // Contexte neuf : aucun compte, aucun jeton.
  const anonymous = await browser.newContext();
  const visitor = await anonymous.newPage();
  const errors = watchErrors(visitor);

  await visitor.goto(`/e/${token}`);
  await expect(visitor.getByText('Five du jeudi')).toBeVisible();
  await expect(visitor.getByText('Créer un compte pour participer')).toBeVisible();
  await expectHealthy(visitor, errors);

  await anonymous.close();
});

test('parcours 3 — s-inscrire, liste d-attente et promotion', async ({ browser }) => {
  const organizerCtx = await browser.newContext();
  const organizer = await organizerCtx.newPage();
  await register(organizer, account('Sebastien'));
  const eventUrl = await createEvent(organizer, { title: 'Five du mardi', capacity: 1 });

  // Premier joueur : confirme.
  const firstCtx = await browser.newContext();
  const first = await firstCtx.newPage();
  await register(first, account('Lucas'));
  await first.goto(eventUrl);
  await first.getByRole('button', { name: 'Je participe' }).click();
  await expect(first.getByText('Votre place est confirmée')).toBeVisible();

  // Second joueur : la capacite est atteinte, donc liste d'attente.
  const secondCtx = await browser.newContext();
  const second = await secondCtx.newPage();
  const errors = watchErrors(second);
  await register(second, account('Yanis'));
  await second.goto(eventUrl);
  await second.getByRole('button', { name: "Rejoindre la liste d'attente" }).click();
  await expect(second.getByText("vous êtes en liste d'attente")).toBeVisible();
  await expect(second.getByText('Complet')).toBeVisible();
  await expectHealthy(second, errors);

  // Le confirme se desiste : le suivant doit etre promu automatiquement.
  await first.getByRole('button', { name: 'Me désister' }).click();
  await expect(first.getByText("liste d'attente prend votre place")).toBeVisible();

  await second.reload();
  await expect(second.getByRole('button', { name: 'Me désister' })).toBeVisible();
  await expect(second.getByText("Vous êtes en liste d'attente")).toHaveCount(0);

  for (const ctx of [organizerCtx, firstCtx, secondCtx]) await ctx.close();
});

test('parcours 2 — rejoindre un groupe par invitation', async ({ browser }) => {
  const ownerCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  await register(owner, account('Sebastien'));
  const groupUrl = await createGroup(owner, 'Les Rémois');

  await owner.getByRole('button', { name: "Générer un lien d'invitation" }).click();
  await expect(owner.getByRole('button', { name: 'Partager' })).toBeVisible();

  const inviteToken = await owner.evaluate(async () => {
    const id = window.location.pathname.split('/').pop();
    const res = await fetch(`http://localhost:3001/api/groups/${id}/invitations`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
    });
    return (await res.json())[0].token;
  });

  // L'invite consulte l'apercu sans compte : c'est le point du lien WhatsApp.
  const guestCtx = await browser.newContext();
  const guest = await guestCtx.newPage();
  const errors = watchErrors(guest);

  await guest.goto(`/invitation/${inviteToken}`);
  await expect(guest.getByText('Les Rémois')).toBeVisible();
  await expectHealthy(guest, errors);

  // Il est renvoye vers la connexion, puis doit retomber sur l'invitation.
  await guest.getByRole('button', { name: 'Se connecter pour rejoindre' }).click();
  await guest.waitForURL('**/login');

  await register(guest, account('Karim'));
  await guest.goto(`/invitation/${inviteToken}`);
  await guest.getByRole('button', { name: 'Rejoindre le groupe' }).click();

  await guest.waitForURL(/\/groupes\/[0-9a-f-]{36}/);
  await expect(guest.getByText('Membres')).toBeVisible();
  expect(guest.url()).toBe(groupUrl);

  for (const ctx of [ownerCtx, guestCtx]) await ctx.close();
});
