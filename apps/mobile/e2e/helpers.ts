import { expect, Page } from '@playwright/test';

export type Account = { email: string; password: string; firstName: string };

let counter = 0;

export const account = (firstName = 'Joueur'): Account => {
  counter += 1;
  return {
    email: `mobile-${Date.now()}-${counter}@example.com`,
    password: 'Test1234!',
    firstName,
  };
};

/**
 * Cree un compte et laisse l'application sur le tableau de bord.
 *
 * Les champs sont cibles par `testID` : react-native-web le rend en
 * `data-testid`, ce qui donne des selecteurs stables la ou les libelles
 * changent au fil des maquettes.
 */
export const register = async (page: Page, who: Account) => {
  await page.goto('/register');
  await page.getByTestId('register-email').fill(who.email);
  await page.getByTestId('register-password').fill(who.password);
  await page.getByTestId('register-firstName').fill(who.firstName);
  await page.getByTestId('register-tos').click();
  await page.getByTestId('register-submit').click();
  await page.waitForURL('**/dashboard');
};

export const createGroup = async (page: Page, name: string, city = 'Reims') => {
  await page.goto('/groupes/nouveau');
  await page.getByTestId('create-group-name').fill(name);
  await page.getByTestId('create-group-city').fill(city);
  await page.getByTestId('create-group-submit').click();
  await page.waitForURL(/\/groupes\/[0-9a-f-]{36}/);
  return page.url();
};

/** Collecte les erreurs de page, pour `expectHealthy`. */
export const watchErrors = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
};

/** Deux verifications que chaque ecran doit passer. */
export const expectHealthy = async (page: Page, errors: string[]) => {
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(overflows, 'debordement horizontal').toBe(false);
  expect(errors, 'erreurs JS').toEqual([]);
};
