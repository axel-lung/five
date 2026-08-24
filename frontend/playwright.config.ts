import { defineConfig, devices } from '@playwright/test';

/**
 * Parcours navigateur, en viewport telephone.
 *
 * Les deux serveurs sont demarres par Playwright : l'API sur un PostgreSQL
 * embarque (`npm run dev:local`, base ephemere recreee a chaque lancement) et
 * le front en mode developpement. Aucun Docker requis.
 *
 * Un seul worker : les deux serveurs et la base sont partages, des tests
 * paralleles se marcheraient dessus.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],

  use: {
    baseURL: 'http://localhost:3000',
    // Pixel 5 plutot qu'iPhone : le descripteur iPhone impose WebKit via son
    // `defaultBrowserType`, qui l'emporte sur `browserName`, et WebKit n'est
    // pas installe ici. Le Pixel 5 donne un viewport telephone equivalent
    // (393 x 851, tactile) sur Chromium.
    ...devices['Pixel 5'],
    trace: 'retain-on-failure',

    // Sur une machine de developpement, Playwright utilise le navigateur
    // qu'il a lui-meme telecharge (`npx playwright install`) et cette
    // variable reste vide. Elle sert aux environnements qui fournissent un
    // Chromium prealable, dont la version peut ne pas correspondre a celle
    // attendue par @playwright/test.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },

  webServer: [
    {
      command: 'npm run dev:local',
      cwd: '../backend',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // La suite cree une dizaine de comptes ; sans cela elle se heurte au
      // plafond anti-brute-force de /api/auth, qui n'est desarme qu'en
      // developpement (voir backend/src/middleware/rateLimit.ts).
      env: { DISABLE_RATE_LIMIT: '1' },
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { VITE_APP_API_URL: 'http://localhost:3001/api' },
    },
  ],
});
