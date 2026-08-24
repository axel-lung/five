import { DataTypes } from 'sequelize';
import type { MigrationParams } from '../db/migrator';

/**
 * D-06 : blocage entre joueurs. S-05 : signalements.
 *
 * Le blocage est dirige : `blocker` bloque `blocked`. L'effet est reciproque
 * a l'usage (ni l'un ni l'autre ne peut inviter ou rejoindre l'autre), mais
 * seul le bloqueur peut le lever — d'ou une ligne par sens.
 */
export const up = async ({ context: q }: MigrationParams) => {
  await q.createTable('user_blocks', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    blocker_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    blocked_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  await q.addConstraint('user_blocks', {
    fields: ['blocker_id', 'blocked_id'],
    type: 'unique',
    name: 'user_blocks_blocker_id_blocked_id_unique',
  });

  // Le sens le plus interroge : « qui m'a bloque ? », teste a chaque
  // inscription a un evenement.
  await q.addIndex('user_blocks', ['blocked_id'], { name: 'user_blocks_blocked_id_idx' });

  await q.createTable('reports', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    reporter_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    // Cible polymorphe : pas de FK, la ressource peut disparaitre alors que le
    // signalement doit rester tracable pour la moderation (B-02).
    target_type: {
      type: DataTypes.ENUM('user', 'group', 'event'),
      allowNull: false,
    },
    target_id: { type: DataTypes.UUID, allowNull: false },
    reason: { type: DataTypes.STRING(100), allowNull: false },
    details: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM('open', 'reviewing', 'resolved', 'dismissed'),
      allowNull: false,
      defaultValue: 'open',
    },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  await q.addIndex('reports', ['status'], { name: 'reports_status_idx' });
};

export const down = async ({ context: q }: MigrationParams) => {
  await q.dropTable('reports');
  await q.dropTable('user_blocks');

  for (const enumType of ['enum_reports_target_type', 'enum_reports_status']) {
    await q.sequelize.query(`DROP TYPE IF EXISTS "${enumType}";`);
  }
};
