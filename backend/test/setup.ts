import { sequelize } from '../src/models';

const TABLES = [
  'reports',
  'user_blocks',
  'event_inscriptions',
  'events',
  'group_invitations',
  'group_members',
  'groups',
  'users',
];

// CASCADE gere les cles etrangeres, l'ordre des tables n'a donc pas d'importance.
// La table des migrations (SequelizeMeta) est volontairement preservee.
beforeEach(async () => {
  await sequelize.query(`TRUNCATE ${TABLES.join(', ')} CASCADE;`);
});

afterAll(async () => {
  await sequelize.close();
});
