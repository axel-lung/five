import { DataTypes } from 'sequelize';
import type { MigrationParams } from '../db/migrator';

/**
 * PA-03 : attribution d'un evenement a un complexe.
 *
 * `events.location` reste une chaine libre : tous les five ne se jouent pas
 * dans un complexe partenaire, et un organisateur doit pouvoir saisir un
 * lieu quelconque. `venue_id` s'y ajoute quand le lieu est un partenaire
 * reference, ce qui rendra la commission (PA-04) calculable.
 *
 * La fiche complexe complete (PA-01 : horaires, terrains, contact) est
 * ciblee V1.5 ; cette table n'en porte que le minimum identifiant.
 */
export const up = async ({ context: q }: MigrationParams) => {
  await q.createTable('venues', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    address: { type: DataTypes.STRING(255), allowNull: true },
    city: { type: DataTypes.STRING(100), allowNull: true },
    // Un partenaire sous contrat, par opposition a un lieu simplement
    // reference : seul le premier ouvre droit a commission (PA-04).
    is_partner: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  await q.addIndex('venues', ['city'], { name: 'venues_city_idx' });

  await q.addColumn('events', 'venue_id', {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'venues', key: 'id' },
    // Un complexe retire du catalogue ne doit pas emporter les evenements
    // qui s'y sont joues.
    onDelete: 'SET NULL',
  });

  await q.addIndex('events', ['venue_id'], { name: 'events_venue_id_idx' });
};

export const down = async ({ context: q }: MigrationParams) => {
  await q.removeIndex('events', 'events_venue_id_idx');
  await q.removeColumn('events', 'venue_id');
  await q.dropTable('venues');
};
