import { test, expect } from '@playwright/test';
import { account, createGroup, expectHealthy, register, watchErrors } from './helpers';

/**
 * Lot A : administration d'un groupe depuis l'application.
 *
 * Le point le plus important est G-02 : sans generation de lien, le parcours
 * critique « rejoindre un groupe » restait a moitie fait sur mobile.
 */
test('genere un lien d-invitation, qu-un invite peut ouvrir', async ({ browser }) => {
  const ownerCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  const errors = watchErrors(owner);

  await register(owner, account('Sebastien'));
  const groupUrl = await createGroup(owner, 'Les Rémois');

  await owner.getByTestId('invitation-create').click();
  await expect(owner.getByText('Partager')).toBeVisible();
  await expectHealthy(owner, errors);

  const token = await owner.evaluate(async () => {
    const id = window.location.pathname.split('/').pop();
    const res = await fetch(`http://localhost:3001/api/groups/${id}/invitations`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
    });
    return (await res.json()).find((i: any) => i.usable).token;
  });

  const guestCtx = await browser.newContext();
  const guest = await guestCtx.newPage();
  await register(guest, account('Karim'));
  await guest.goto(`/invitation/${token}`);
  await expect(guest.getByText('Les Rémois')).toBeVisible();

  await guest.getByText('Rejoindre le groupe').click();
  await guest.waitForURL(/\/groupes\/[0-9a-f-]{36}/);
  expect(guest.url()).toBe(groupUrl);

  for (const ctx of [ownerCtx, guestCtx]) await ctx.close();
});

test('revoque un lien d-invitation', async ({ browser }) => {
  const ownerCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  await register(owner, account('Sebastien'));
  await createGroup(owner, 'Les Rémois');

  await owner.getByTestId('invitation-create').click();
  await expect(owner.getByText('Partager')).toBeVisible();

  owner.on('dialog', (d) => d.accept());
  await owner.getByTestId('invitation-revoke').click();
  await expect(owner.getByText('Lien révoqué.')).toBeVisible();

  await ownerCtx.close();
});

test('modifie l-identite du groupe', async ({ page }) => {
  const errors = watchErrors(page);
  await register(page, account('Sebastien'));
  await createGroup(page, 'Les Rémois');

  await page.getByTestId('group-edit').click();
  await page.getByTestId('group-name').fill('Les Rémois du mardi');
  await page.getByTestId('group-description').fill('Five hebdo, niveau tranquille.');
  await page.getByTestId('group-save').click();

  await expect(page.getByText('Groupe mis à jour.')).toBeVisible();
  await expectHealthy(page, errors);

  await page.reload();
  await expect(page.getByText('Les Rémois du mardi')).toBeVisible();
});

test('transmet la propriete, ce qui debloque le depart du proprietaire', async ({ browser }) => {
  const ownerCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  await register(owner, account('Sebastien'));
  const groupUrl = await createGroup(owner, 'Les Rémois');

  await owner.getByTestId('invitation-create').click();
  await expect(owner.getByText('Partager')).toBeVisible();
  const token = await owner.evaluate(async () => {
    const id = window.location.pathname.split('/').pop();
    const res = await fetch(`http://localhost:3001/api/groups/${id}/invitations`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
    });
    return (await res.json()).find((i: any) => i.usable).token;
  });

  const memberCtx = await browser.newContext();
  const member = await memberCtx.newPage();
  await register(member, account('Lucas'));
  await member.goto(`/invitation/${token}`);
  await member.getByText('Rejoindre le groupe').click();
  await member.waitForURL(groupUrl);

  // Le proprietaire ne peut pas partir tant qu'il n'a pas transmis.
  await owner.reload();
  await expect(owner.getByText('Pour le quitter, transmettez-le')).toBeVisible();
  await expect(owner.getByTestId('group-leave')).toHaveCount(0);

  owner.on('dialog', (d) => d.accept());
  await owner.getByText('Gérer ce membre').click();
  await owner.getByTestId('member-transfer').click();
  await expect(owner.getByText('Propriété transmise.')).toBeVisible();

  await owner.reload();
  await expect(owner.getByTestId('group-leave')).toBeVisible();

  for (const ctx of [ownerCtx, memberCtx]) await ctx.close();
});

test('un simple membre ne voit aucune action d-administration', async ({ browser }) => {
  const ownerCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  await register(owner, account('Sebastien'));
  const groupUrl = await createGroup(owner, 'Les Rémois');

  await owner.getByTestId('invitation-create').click();
  await expect(owner.getByText('Partager')).toBeVisible();
  const token = await owner.evaluate(async () => {
    const id = window.location.pathname.split('/').pop();
    const res = await fetch(`http://localhost:3001/api/groups/${id}/invitations`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
    });
    return (await res.json()).find((i: any) => i.usable).token;
  });

  const memberCtx = await browser.newContext();
  const member = await memberCtx.newPage();
  const errors = watchErrors(member);
  await register(member, account('Lucas'));
  await member.goto(`/invitation/${token}`);
  await member.getByText('Rejoindre le groupe').click();
  await member.waitForURL(groupUrl);

  await expect(member.getByTestId('group-edit')).toHaveCount(0);
  await expect(member.getByTestId('invitation-create')).toHaveCount(0);
  await expect(member.getByTestId('group-delete')).toHaveCount(0);
  await expect(member.getByTestId('group-leave')).toBeVisible();
  // S-05 : un non-administrateur peut signaler le groupe.
  await expect(member.getByTestId('report-open')).toBeVisible();
  await expectHealthy(member, errors);

  for (const ctx of [ownerCtx, memberCtx]) await ctx.close();
});
