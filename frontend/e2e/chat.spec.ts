import { test, expect } from '@playwright/test';
import { expectHealthy, groupWithMember, watchErrors } from './helpers';

/**
 * S-01 : chat instantane de groupe.
 *
 * Deux contextes navigateur, et non deux onglets : c'est la seule facon de
 * prouver que le message traverse reellement le WebSocket d'un utilisateur a
 * l'autre. Un seul contexte ne testerait que l'echo local de l'expediteur.
 *
 * Depend de l'attachement de la socket dans backend/devserver.ts — le point
 * d'entree que Playwright demarre. Sans lui, l'assertion « sans rechargement »
 * passerait pour la mauvaise raison.
 */

const openChat = async (page: any, groupUrl: string) => {
  await page.goto(groupUrl);
  await page.getByRole('link', { name: 'Ouvrir la discussion' }).click();
  await page.waitForURL(/\/groupes\/[0-9a-f-]{36}\/chat/);
};

test('delivre un message a l-autre membre sans rechargement', async ({ browser }) => {
  const { ownerCtx, owner, memberCtx, member, groupUrl } = await groupWithMember(browser);
  const errors = watchErrors(member);

  await openChat(owner, groupUrl);
  await openChat(member, groupUrl);

  await owner.fill('#chatMessage', 'On joue mardi 19h ?');
  await owner.getByRole('button', { name: 'Envoyer' }).click();

  // L'expediteur voit son message.
  await expect(owner.getByText('On joue mardi 19h ?')).toBeVisible({ timeout: 5000 });

  // Et l'autre aussi, sans avoir rien fait. C'est l'assertion du temps reel.
  await expect(member.getByText('On joue mardi 19h ?')).toBeVisible({ timeout: 5000 });

  // Un mot long sans espace est exactement ce qui fait deborder un fil de chat.
  await member.fill('#chatMessage', 'Supercalifragilisticexpialidocioussansaucuneespaceduttout');
  await member.getByRole('button', { name: 'Envoyer' }).click();
  await expect(
    owner.getByText('Supercalifragilisticexpialidocioussansaucuneespaceduttout')
  ).toBeVisible({ timeout: 5000 });

  await expectHealthy(member, errors);

  await ownerCtx.close();
  await memberCtx.close();
});

test('propage la suppression d-un message aux deux cotes', async ({ browser }) => {
  const { ownerCtx, owner, memberCtx, member, groupUrl } = await groupWithMember(browser);

  await openChat(owner, groupUrl);
  await openChat(member, groupUrl);

  await member.fill('#chatMessage', 'Message a retirer');
  await member.getByRole('button', { name: 'Envoyer' }).click();
  await expect(owner.getByText('Message a retirer')).toBeVisible({ timeout: 5000 });

  member.once('dialog', (dialog) => dialog.accept());
  await member.getByRole('button', { name: 'Supprimer' }).click();

  // La pierre tombale remplace le message des deux cotes : elle voyage comme
  // un message, faute de quoi le second client garderait un texte efface.
  await expect(member.getByText('Message supprimé')).toBeVisible({ timeout: 5000 });
  await expect(owner.getByText('Message supprimé')).toBeVisible({ timeout: 5000 });
  await expect(owner.getByText('Message a retirer')).toHaveCount(0);

  await ownerCtx.close();
  await memberCtx.close();
});

test('affiche une pastille de non-lus sur le groupe', async ({ browser }) => {
  const { ownerCtx, owner, memberCtx, member, groupUrl } = await groupWithMember(browser);

  await openChat(owner, groupUrl);

  // Le membre reste sur la liste des groupes : il ne lit pas le chat.
  await member.goto('/groupes');

  await owner.fill('#chatMessage', 'Personne ne me lit');
  await owner.getByRole('button', { name: 'Envoyer' }).click();

  await member.reload();
  await expect(member.getByLabel('1 messages non lus')).toBeVisible({ timeout: 5000 });

  // Ouvrir la discussion eteint la pastille.
  await openChat(member, groupUrl);
  await expect(member.getByText('Personne ne me lit')).toBeVisible({ timeout: 5000 });
  await member.goto('/groupes');
  await expect(member.getByLabel('1 messages non lus')).toHaveCount(0);

  await ownerCtx.close();
  await memberCtx.close();
});
