import { DataTypes } from 'sequelize';
import type { MigrationParams } from '../db/migrator';

/**
 * G-02 : invitations de groupe par lien, avec expiration.
 *
 * Le token est distinct de l'id : il circule dans des liens WhatsApp et ne
 * doit rien reveler de la ressource. La revocation est un horodatage plutot
 * qu'une suppression, pour garder trace de qui a invite qui (G-03).
 */
export const up = async ({ context: q }: MigrationParams) => {
  await q.createTable('group_invitations', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    group_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'groups', key: 'id' },
      onDelete: 'CASCADE',
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    token: { type: DataTypes.UUID, allowNull: false, unique: true },
    role: {
      type: DataTypes.ENUM('admin', 'member'),
      allowNull: false,
      defaultValue: 'member',
    },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    // null = nombre d'utilisations illimite jusqu'a expiration.
    max_uses: { type: DataTypes.INTEGER, allowNull: true },
    uses: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    revoked_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  await q.addIndex('group_invitations', ['group_id'], {
    name: 'group_invitations_group_id_idx',
  });
};

export const down = async ({ context: q }: MigrationParams) => {
  await q.dropTable('group_invitations');
  await q.sequelize.query('DROP TYPE IF EXISTS "enum_group_invitations_role";');
};
