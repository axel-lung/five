import { DataTypes } from 'sequelize';
import type { MigrationParams } from '../db/migrator';

/**
 * B-01 / B-02 / B-06 : back-office.
 *
 * `users.role` reste volontairement non modifiable par l'API : aucune route
 * ne permet de se promeuvoir administrateur, ce serait une escalade de
 * privileges a une requete. La promotion passe par `npm run make-admin`,
 * qui exige un acces a la base.
 */
export const up = async ({ context: q }: MigrationParams) => {
  await q.addColumn('users', 'role', {
    type: DataTypes.ENUM('user', 'admin'),
    allowNull: false,
    defaultValue: 'user',
  });

  // B-02 : suspension d'un compte par la moderation. Distinct de deleted_at,
  // qui est un effacement RGPD demande par le joueur lui-meme.
  await q.addColumn('users', 'suspended_at', { type: DataTypes.DATE, allowNull: true });
  await q.addColumn('users', 'suspension_reason', {
    type: DataTypes.STRING(255),
    allowNull: true,
  });

  await q.createTable('audit_logs', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    // L'auteur n'est pas efface avec son compte : un journal d'audit qui
    // disparait avec la personne auditee ne sert a rien. D'ou SET NULL.
    actor_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    },
    action: { type: DataTypes.STRING(100), allowNull: false },
    target_type: { type: DataTypes.STRING(50), allowNull: false },
    target_id: { type: DataTypes.UUID, allowNull: true },
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  await q.addIndex('audit_logs', ['created_at'], { name: 'audit_logs_created_at_idx' });
  await q.addIndex('audit_logs', ['target_type', 'target_id'], {
    name: 'audit_logs_target_idx',
  });

  // B-02 : trace de qui a traite un signalement et comment.
  await q.addColumn('reports', 'resolved_by', {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    onDelete: 'SET NULL',
  });
  await q.addColumn('reports', 'resolution_note', { type: DataTypes.TEXT, allowNull: true });
};

export const down = async ({ context: q }: MigrationParams) => {
  await q.removeColumn('reports', 'resolution_note');
  await q.removeColumn('reports', 'resolved_by');
  await q.dropTable('audit_logs');
  await q.removeColumn('users', 'suspension_reason');
  await q.removeColumn('users', 'suspended_at');
  await q.removeColumn('users', 'role');
  await q.sequelize.query('DROP TYPE IF EXISTS "enum_users_role";');
};
