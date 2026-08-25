import { expect, Page } from '@playwright/test';
import path from 'path';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';

const execFile = promisify(execFileCb);

/** Meme base ephemere que celle demarree par `npm run dev:local`. */
const DEV_DATABASE_URL = 'postgres://dev:dev@localhost:55440/five_dev';

export type Account = {
  email: string;
  password: string;
  firstName: string;
};

let counter = 0;

export const account = (firstName = 'Joueur'): Account => {
  counter += 1;
  return {
    email: `e2e-${Date.now()}-${counter}@example.com`,
    password: 'Test1234!',
    firstName,
  };
};

/** Cree un compte et laisse la page sur le tableau de bord. */
export const register = async (page: Page, who: Account) => {
  await page.goto('/register');
  await page.fill('#email', who.email);
  await page.fill('#password', who.password);
  await page.fill('#firstName', who.firstName);
  await page.check('#acceptTos');
  await page.click('button[type=submit]');
  await page.waitForURL('**/dashboard');
};

export const login = async (page: Page, who: Account) => {
  await page.goto('/login');
  await page.fill('#email', who.email);
  await page.fill('#password', who.password);
  await page.click('button[type=submit]');
};

/** Cree une session et renvoie son URL. */
export const createEvent = async (
  page: Page,
  fields: { title: string; dateTime?: string; capacity?: number; location?: string }
) => {
  await page.goto('/sessions/nouvelle');
  await page.fill('#title', fields.title);
  await page.fill('#dateTime', fields.dateTime ?? '2027-03-09T19:00');
  if (fields.location) await page.fill('#location', fields.location);
  await page.fill('#capacity', String(fields.capacity ?? 10));
  await page.click('button[type=submit]');
  await page.waitForURL(/\/sessions\/[0-9a-f-]{36}/);
  return page.url();
};

export const createGroup = async (page: Page, name: string, city = 'Reims') => {
  await page.goto('/groupes/nouveau');
  await page.fill('#name', name);
  await page.fill('#city', city);
  await page.click('button[type=submit]');
  await page.waitForURL(/\/groupes\/[0-9a-f-]{36}/);
  return page.url();
};

/**
 * Promeut un compte administrateur.
 *
 * Aucune route ne le permet, par choix de conception : la promotion exige un
 * acces a la base. Le test passe donc par le meme script que l'exploitant.
 */
export const makeAdmin = async (email: string) => {
  // Playwright s'execute depuis frontend/ : le backend est son voisin.
  await execFile('npx', ['ts-node', '--transpile-only', 'src/scripts/makeAdmin.ts', email], {
    cwd: path.resolve(process.cwd(), '..', 'backend'),
    env: {
      ...process.env,
      DATABASE_URL: DEV_DATABASE_URL,
      JWT_SECRET: 'dev-only-secret',
    },
  });
};

/**
 * Deux verifications que chaque ecran doit passer : rien ne deborde
 * horizontalement, et aucune erreur JS n'a ete levee.
 */
export const expectHealthy = async (page: Page, errors: string[]) => {
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(overflows, 'debordement horizontal').toBe(false);
  expect(errors, 'erreurs JS').toEqual([]);
};

/** Collecte les erreurs de page pour `expectHealthy`. */
export const watchErrors = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
};

/**
 * Genere un lien d'invitation et renvoie son jeton.
 *
 * Attend d'abord la carte d'invitation : elle n'apparait qu'une fois la liste
 * des membres chargee, seule source du role de l'appelant.
 */
export const inviteToken = async (owner: Page) => {
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
export const groupWithMember = async (browser: any) => {
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
