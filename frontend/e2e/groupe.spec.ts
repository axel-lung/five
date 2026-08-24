import { test, expect, Page } from '@playwright/test';
import { account, createGroup, expectHealthy, register, watchErrors } from './helpers';

/**
 * Genere un lien d'invitation et renvoie son jeton.
 *
 * Attend d'abord la carte d'invitation : elle n'apparait qu'une fois la liste
 * des membres chargee, seule source du role de l'appelant.
 */
const inviteToken = async (owner: Page) => {
  await expect(owner.getByText('Inviter des joueurs')).toBeVisible();

  const generate = owner.getByRole('button', { name: "Générer un lien d'invitation" });
  if (await generate.count()) await generate.click();
  await expect(owner.getByRole('button', { name: 'Partager' })).toBeVisible();

  return owner.evaluate(async () => {
    const id = window.location.pathname.split('/').pop();
    const res = await fetch(`http://localhost:3001/api/groups/${id}/invitations`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
    });
    return (await res.json()).find((i: any) => i.usable).token;
  });
};

/** Un groupe, son proprietaire et un membre simple. */
const groupWithMember = async (browser: any) => {
  const ownerCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  await register(owner, account('Sebastien'));
  const groupUrl = await createGroup(owner, 'Les Rémois');

  const token = await inviteToken(owner);

  const memberCtx = await browser.newContext();
  const member = await memberCtx.newPage();
  const memberAccount = account('Lucas');
  await register(member, memberAccount);
  await member.goto(`/invitation/${token}`);
  await member.getByRole('button', { name: 'Rejoindre le groupe' }).click();
  await member.waitForURL(groupUrl);

  return { ownerCtx, owner, memberCtx, member, groupUrl, memberAccount };
};

test('modifie l-identite du groupe', async ({ page }) => {
  const errors = watchErrors(page);
  await register(page, account('Sebastien'));
  await createGroup(page, 'Les Rémois');

  await page.getByRole('button', { name: 'Modifier le groupe' }).click();
  await page.fill('#groupName', 'Les Rémois du mardi');
  await page.fill('#groupDescription', 'Five hebdo, niveau tranquille.');
  await page.selectOption('#groupAccess', 'public');
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(page.getByText('Groupe mis à jour')).toBeVisible();
  await expectHealthy(page, errors);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Les Rémois du mardi' })).toBeVisible();
  await expect(page.getByText('Five hebdo, niveau tranquille.')).toBeVisible();
});

test('promeut un membre admin puis le retrograde', async ({ browser }) => {
  const { ownerCtx, owner, memberCtx } = await groupWithMember(browser);

  await owner.reload();
  await owner.getByRole('button', { name: 'Promouvoir admin' }).click();
  await expect(owner.getByText('Rôle mis à jour')).toBeVisible();
  await expect(owner.getByText('Admin')).toBeVisible();

  await owner.getByRole('button', { name: 'Rétrograder membre' }).click();
  await expect(owner.getByText('Rôle mis à jour')).toBeVisible();

  for (const ctx of [ownerCtx, memberCtx]) await ctx.close();
});

// Le cul-de-sac corrige au lot 5 : leaveGroup exige une transmission que rien
// ne permettait. L'ecran doit l'expliquer avant que l'API refuse.
test('transmet la propriete, ce qui debloque le depart du proprietaire', async ({ browser }) => {
  const { ownerCtx, owner, memberCtx, member } = await groupWithMember(browser);

  await owner.reload();
  await expect(owner.getByText('Pour le quitter, transmettez-le')).toBeVisible();
  await expect(owner.getByRole('button', { name: 'Quitter le groupe' })).toHaveCount(0);

  owner.on('dialog', (d) => d.accept());
  await owner.getByRole('button', { name: 'Transmettre le groupe' }).click();
  await expect(owner.getByText('Propriété transmise')).toBeVisible();

  // L'ancien proprietaire devient admin et peut desormais partir.
  await owner.reload();
  await expect(owner.getByRole('button', { name: 'Quitter le groupe' })).toBeVisible();
  await owner.getByRole('button', { name: 'Quitter le groupe' }).click();
  await owner.waitForURL('**/groupes');

  // Le nouveau proprietaire a bien la main.
  await member.reload();
  await expect(member.getByRole('button', { name: 'Modifier le groupe' })).toBeVisible();

  for (const ctx of [ownerCtx, memberCtx]) await ctx.close();
});

test('retire un membre du groupe', async ({ browser }) => {
  const { ownerCtx, owner, memberCtx } = await groupWithMember(browser);

  await owner.reload();
  await expect(owner.getByText('Membres (2)')).toBeVisible();

  owner.on('dialog', (d) => d.accept());
  await owner.getByRole('button', { name: 'Retirer' }).click();
  await expect(owner.getByText('Membre retiré')).toBeVisible();
  await expect(owner.getByText('Membres (1)')).toBeVisible();

  for (const ctx of [ownerCtx, memberCtx]) await ctx.close();
});

test('revoque un lien d-invitation', async ({ browser }) => {
  const ownerCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  await register(owner, account('Sebastien'));
  await createGroup(owner, 'Les Rémois');
  const token = await inviteToken(owner);

  await owner.getByRole('button', { name: 'Révoquer ce lien' }).click();
  await expect(owner.getByText('Lien révoqué')).toBeVisible();

  // Le lien revoque ne doit plus rien montrer, meme a qui le detient.
  const guestCtx = await browser.newContext();
  const guest = await guestCtx.newPage();
  await guest.goto(`/invitation/${token}`);
  await expect(guest.getByText(/n'est plus valable|not found/i)).toBeVisible();

  for (const ctx of [ownerCtx, guestCtx]) await ctx.close();
});

test('un simple membre ne voit aucune action d-administration', async ({ browser }) => {
  const { ownerCtx, memberCtx, member } = await groupWithMember(browser);
  const errors = watchErrors(member);

  await member.reload();
  await expect(member.getByRole('button', { name: 'Modifier le groupe' })).toHaveCount(0);
  await expect(member.getByRole('button', { name: "Générer un lien d'invitation" })).toHaveCount(0);
  await expect(member.getByRole('button', { name: 'Promouvoir admin' })).toHaveCount(0);
  await expect(member.getByRole('button', { name: 'Quitter le groupe' })).toBeVisible();
  await expectHealthy(member, errors);

  for (const ctx of [ownerCtx, memberCtx]) await ctx.close();
});
