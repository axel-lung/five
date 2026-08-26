import { defineConfig, devices } from '@playwright/test';

/**
 * Parcours de l'application mobile, executes sur son export web.
 *
 * Expo produit la meme application pour iOS, Android et le web : l'exporter
 * en web permet de valider les ecrans, la navigation et le cablage a l'API
 * sans emulateur ni appareil.
 *
 * Limites a connaitre, et a ne pas confondre avec une validation complete :
 *
 * - le selecteur d'images natif et les notifications push ne fonctionnent pas
 *   dans ce mode ; ces deux points ne se verifient que sur un appareil ;
 * - l'export web ne masque pas l'onglet quitte, si bien que deux ecrans
 *   peuvent etre visibles en meme temps la ou react-navigation n'en montre
 *   qu'un sur natif. Une assertion ne doit donc jamais reposer sur l'absence
 *   ou l'invisibilite d'un ecran precedent : verifier l'effet reel — l'etat
 *   cote API, ou la presence de ce que l'on attend.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],

  use: {
    baseURL: 'http://localhost:3002',
    // Pixel 5 plutot qu'iPhone : le descripteur iPhone impose WebKit via son
    // `defaultBrowserType`, et seul Chromium est disponible en integration.
    ...devices['Pixel 5'],
    trace: 'retain-on-failure',

    // Vide sur une machine de developpement, ou Playwright utilise le
    // navigateur qu'il a lui-meme telecharge.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },

  webServer: [
    {
      command: 'npm run dev:local',
      cwd: '../../backend',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // La suite cree une dizaine de comptes ; sans cela elle se heurte au
      // plafond anti-brute-force de /api/auth.
      env: { DISABLE_RATE_LIMIT: '1' },
    },
    {
      command: 'npm run build:web && node e2e/serve.cjs',
      url: 'http://localhost:3002',
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: { EXPO_PUBLIC_API_URL: 'http://localhost:3001/api' },
    },
  ],
});
