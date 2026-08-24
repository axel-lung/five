import { DataTypes } from 'sequelize';
import type { MigrationParams } from '../db/migrator';

/**
 * C-03 : disponibilites du joueur.
 *
 * Les creneaux sont un JSONB plutot qu'une table dediee : ils ne sont ni
 * interroges ni joints en V1, seulement affiches sur le profil. La
 * recommandation locale (D-04) est ciblee V2 ; c'est elle qui justifiera
 * une vraie modelisation.
 */
export const up = async ({ context: q }: MigrationParams) => {
  await q.addColumn('users', 'preferred_slots', {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  });

  await q.addColumn('users', 'travel_radius_km', {
    type: DataTypes.INTEGER,
    allowNull: true,
  });
};

export const down = async ({ context: q }: MigrationParams) => {
  await q.removeColumn('users', 'travel_radius_km');
  await q.removeColumn('users', 'preferred_slots');
};
