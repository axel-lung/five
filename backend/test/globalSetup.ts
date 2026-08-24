import path from 'path';
import fs from 'fs';

// embedded-postgres declare `exports` sans champ `types` : TypeScript ne sait
// pas le resoudre par import. On le charge donc a l'execution.
const EmbeddedPostgres = require('embedded-postgres').default;

const DATA_DIR = path.join(__dirname, '..', '.pg-test');
const PORT = 55432;

/**
 * Demarre un vrai PostgreSQL, pas un emulateur.
 *
 * La logique testee repose sur des comportements que seul Postgres fournit :
 * SELECT ... FOR UPDATE, types ENUM, contraintes uniques differables. Un
 * substitut en memoire (pg-mem) ne sait pas les reproduire et donnerait des
 * tests verts sur du code casse.
 */
export default async () => {
  // Un repertoire residuel d'un run interrompu empeche initialise().
  fs.rmSync(DATA_DIR, { recursive: true, force: true });

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'five_test',
    password: 'five_test',
    port: PORT,
    persistent: false,
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase('five_test');

  process.env.DATABASE_URL = `postgres://five_test:five_test@localhost:${PORT}/five_test`;
  process.env.JWT_SECRET = 'test-secret-not-used-outside-tests';
  process.env.NODE_ENV = 'test';

  // Les migrations tournent une fois pour toute la suite ; chaque test repart
  // d'un TRUNCATE (voir test/setup.ts), bien plus rapide qu'un rejeu complet.
  const { migrator } = await import('../src/db/migrator');
  await migrator.up();

  (globalThis as any).__EMBEDDED_PG__ = pg;
};
