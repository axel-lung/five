import { DataTypes } from 'sequelize';
import type { MigrationParams } from '../db/migrator';

/**
 * Beta : declaration d'anomalie par les testeurs.
 *
 * Table distincte de `reports` (S-05) a dessein : un signalement vise un
 * compte, un groupe ou une session et releve de la moderation ; une anomalie
 * vise le produit et releve de l'equipe technique. Les melanger ferait
 * cohabiter deux files aux traitements, aux delais et aux lecteurs
 * differents dans le meme ecran.
 *
 * `context` est un JSONB plutot que des colonnes : ce qu'il est utile de
 * capturer (URL, navigateur, taille d'ecran, et demain la version du build)
 * bougera au fil de la beta, et aucune de ces cles ne sera jamais un critere
 * de recherche SQL.
 */
export const up = async ({ context: q }: MigrationParams) => {
  await q.createTable('bug_reports', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    reporter_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      // Comme partout ailleurs : la suppression de compte est une
      // anonymisation (voir 0003), ce CASCADE ne se declenche donc jamais en
      // pratique.
      onDelete: 'CASCADE',
    },
    kind: {
      type: DataTypes.ENUM('bug', 'display', 'suggestion'),
      allowNull: false,
      defaultValue: 'bug',
    },
    // Le testeur decrit ce qu'il a vecu ; la gravite reelle reste a arbitrer
    // par l'equipe, mais son ressenti oriente l'ordre de traitement.
    severity: {
      type: DataTypes.ENUM('blocking', 'major', 'minor'),
      allowNull: false,
      defaultValue: 'major',
    },
    description: { type: DataTypes.TEXT, allowNull: false },
    context: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    status: {
      type: DataTypes.ENUM('open', 'investigating', 'fixed', 'dismissed'),
      allowNull: false,
      defaultValue: 'open',
    },
    handled_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    },
    resolution_note: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  // L'ecran de suivi ouvre sur les anomalies non traitees : c'est le seul
  // filtre pose a chaque chargement.
  await q.addIndex('bug_reports', ['status'], { name: 'bug_reports_status_idx' });
};

export const down = async ({ context: q }: MigrationParams) => {
  await q.dropTable('bug_reports');

  for (const enumType of [
    'enum_bug_reports_kind',
    'enum_bug_reports_severity',
    'enum_bug_reports_status',
  ]) {
    await q.sequelize.query(`DROP TYPE IF EXISTS "${enumType}";`);
  }
};
