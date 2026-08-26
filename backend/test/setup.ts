import { sequelize } from '../src/models';

const TABLES = [
  'push_tokens',
  'audit_logs',
  'event_reminders',
  'notification_preferences',
  'notifications',
  'reports',
  'bug_reports',
  'user_blocks',
  'event_inscriptions',
  'events',
  'group_invitations',
  'group_message_reads',
  'group_messages',
  'group_members',
  'groups',
  'venues',
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
