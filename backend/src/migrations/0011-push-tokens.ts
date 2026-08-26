import { DataTypes } from 'sequelize';
import type { MigrationParams } from '../db/migrator';

/**
 * N-01 : jetons de notification push, un par appareil.
 *
 * Un meme compte peut etre connecte sur plusieurs appareils : la cle unique
 * porte sur le jeton, pas sur l'utilisateur. Un jeton peut aussi changer de
 * proprietaire — un telephone revendu, un compte partage — d'ou la mise a
 * jour de `user_id` plutot que le rejet du doublon.
 *
 * `timezone` est indispensable aux heures de silence : elles sont stockees en
 * heures locales 0-23, et le serveur n'a aucun moyen de deviner celles du
 * joueur. C'est l'appareil qui la connait, il la declare en s'enregistrant.
 */
export const up = async ({ context: q }: MigrationParams) => {
  await q.createTable('push_tokens', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    token: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    platform: {
      type: DataTypes.ENUM('ios', 'android', 'web'),
      allowNull: false,
    },
    timezone: { type: DataTypes.STRING(64), allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  // L'acces dominant : tous les appareils d'un destinataire, a chaque envoi.
  await q.addIndex('push_tokens', ['user_id'], { name: 'push_tokens_user_id_idx' });
};

export const down = async ({ context: q }: MigrationParams) => {
  await q.dropTable('push_tokens');
  await q.sequelize.query('DROP TYPE IF EXISTS "enum_push_tokens_platform";');
};
