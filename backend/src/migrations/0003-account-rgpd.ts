import { DataTypes } from 'sequelize';
import type { MigrationParams } from '../db/migrator';

/**
 * C-06 / C-05 / C-01 : effacement RGPD, verification d'email, consentements.
 *
 * La suppression de compte est une anonymisation, pas un DELETE : toutes les
 * cles etrangeres vers `users` sont en ON DELETE CASCADE, donc un effacement
 * reel emporterait les groupes, les evenements et — par ricochet — les
 * inscriptions des AUTRES joueurs. `deleted_at` marque le compte efface ;
 * les colonnes personnelles sont videes sur place.
 */
export const up = async ({ context: q }: MigrationParams) => {
  await q.addColumn('users', 'deleted_at', { type: DataTypes.DATE, allowNull: true });

  // Consentements separes : accepter les CGU n'emporte pas le marketing.
  await q.addColumn('users', 'consent_tos_at', { type: DataTypes.DATE, allowNull: true });
  await q.addColumn('users', 'consent_marketing_at', { type: DataTypes.DATE, allowNull: true });

  await q.addColumn('users', 'email_verification_token', {
    type: DataTypes.UUID,
    allowNull: true,
  });
  // Horodatage du dernier envoi : sert de garde anti-spam sur la demande.
  await q.addColumn('users', 'email_verification_sent_at', {
    type: DataTypes.DATE,
    allowNull: true,
  });

  await q.addIndex('users', ['email_verification_token'], {
    name: 'users_email_verification_token_idx',
  });
};

export const down = async ({ context: q }: MigrationParams) => {
  await q.removeIndex('users', 'users_email_verification_token_idx');
  for (const column of [
    'email_verification_sent_at',
    'email_verification_token',
    'consent_marketing_at',
    'consent_tos_at',
    'deleted_at',
  ]) {
    await q.removeColumn('users', column);
  }
};
