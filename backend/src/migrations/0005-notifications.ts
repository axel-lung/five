import { DataTypes } from 'sequelize';
import type { MigrationParams } from '../db/migrator';

/**
 * N-01 / N-04 / N-05 : notifications et preferences.
 *
 * La V1 ne branche aucun transport : les notifications sont persistees et
 * lues par le centre de notifications (N-05). Le push Expo et l'email Resend
 * viendront consommer cette meme table, sans la remodeler.
 *
 * `payload` est un JSONB plutot que des colonnes typees : le contenu depend
 * du `type`, et chaque nouveau type n'a pas a couter une migration.
 */
export const up = async ({ context: q }: MigrationParams) => {
  await q.createTable('notifications', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    type: { type: DataTypes.STRING(50), allowNull: false },
    payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    read_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  // L'acces dominant : les notifications non lues d'un utilisateur, du plus
  // recent au plus ancien.
  await q.addIndex('notifications', ['user_id', 'read_at'], {
    name: 'notifications_user_id_read_at_idx',
  });

  await q.createTable('notification_preferences', {
    user_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    push_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    email_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    // Heures de silence, en heures locales 0-23. null = pas de silence.
    quiet_hours_start: { type: DataTypes.INTEGER, allowNull: true },
    quiet_hours_end: { type: DataTypes.INTEGER, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  // N-03 : trace des relances, pour plafonner a une par evenement et par jour.
  await q.createTable('event_reminders', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    event_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'events', key: 'id' },
      onDelete: 'CASCADE',
    },
    sent_by: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    recipient_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  await q.addIndex('event_reminders', ['event_id'], { name: 'event_reminders_event_id_idx' });
};

export const down = async ({ context: q }: MigrationParams) => {
  await q.dropTable('event_reminders');
  await q.dropTable('notification_preferences');
  await q.dropTable('notifications');
};
