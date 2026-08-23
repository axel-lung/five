import path from 'path';
import { QueryInterface } from 'sequelize';
import { Umzug, SequelizeStorage } from 'umzug';
import { sequelize } from '../models';

// Signature partagee par tous les fichiers de src/migrations.
export type MigrationParams = { context: QueryInterface };

/**
 * Les migrations sont jouees au demarrage du serveur (voir server.ts).
 *
 * Ce choix suppose une seule instance backend : deux conteneurs demarrant
 * simultanement pourraient jouer la meme migration en parallele. Si le service
 * passe un jour en multi-instance, il faudra sortir `migrator.up()` du boot et
 * en faire une etape de deploiement distincte (`npm run migrate`).
 */
export const migrator = new Umzug({
  migrations: {
    // *.js une fois compile dans dist/, *.ts en developpement (ts-node-dev).
    glob: path.join(__dirname, '../migrations/*.{js,ts}'),
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: console,
});

// Permet `npm run migrate -- up|down|pending|executed` sans passer par le boot.
if (require.main === module) {
  migrator.runAsCLI();
}
