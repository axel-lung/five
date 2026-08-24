import path from 'path';
import fs from 'fs';

// embedded-postgres declare `exports` sans champ `types` : meme raison qu'en
// test, on le charge a l'execution.
const EmbeddedPostgres = require('embedded-postgres').default;

/**
 * Lance l'API sur un PostgreSQL embarque, sans Docker.
 *
 *   npm run dev:local        (puis, cote frontend : npm run dev)
 *
 * Sert a derouler l'application de bout en bout sur une machine ou le stack
 * Docker n'est pas disponible. La base est ephemere : elle est recreee a
 * chaque demarrage, migrations comprises. Ne remplace pas docker-compose,
 * qui reste la reference pour un environnement proche de la production.
 *
 * En conteneur, lance en root : embedded-postgres redescend alors sur
 * l'utilisateur `postgres`, qui doit pouvoir ecrire dans ce repertoire
 * (`chmod 777 backend`). En utilisateur normal, le cas ne se pose pas.
 */
const DATA_DIR = path.join(__dirname, '.pg-dev');
const DB_PORT = 55440;

(async () => {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'dev',
    password: 'dev',
    port: DB_PORT,
    persistent: false,
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase('five_dev');

  process.env.DATABASE_URL = `postgres://dev:dev@localhost:${DB_PORT}/five_dev`;
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'dev-only-secret';
  process.env.NODE_ENV = process.env.NODE_ENV ?? 'development';

  const { migrator } = await import('./src/db/migrator');
  await migrator.up();

  const { app } = await import('./src/app');
  const port = Number(process.env.PORT ?? 3001);

  app.listen(port, () => {
    console.log(`API prete sur http://localhost:${port}`);
    console.log('Frontend : VITE_APP_API_URL=http://localhost:3001/api npm run dev');
  });

  const stop = async () => {
    await pg.stop();
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
})();
