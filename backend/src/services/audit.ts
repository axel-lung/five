import { AuditLogModel as AuditLog } from '../models';

/**
 * B-06 : consigner une action sensible.
 *
 * Ecriture seule : rien dans l'application ne modifie ni ne supprime une
 * ligne d'audit, et aucune route ne l'expose en ecriture. Un journal
 * rectifiable ne prouve rien.
 */
export const audit = async (
  actorId: string | null,
  action: string,
  targetType: string,
  targetId: string | null,
  metadata: Record<string, unknown> = {},
  transaction?: any
): Promise<void> => {
  await AuditLog.create(
    { actorId, action, targetType, targetId, metadata },
    transaction ? { transaction } : {}
  );
};
