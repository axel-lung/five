import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { Alert, Card, Field, inputClass, Loading, PageTitle } from '../../components/ui';

const ACTIONS: Record<string, string> = {
  'admin.user.search': 'Recherche de compte',
  'admin.user.view': 'Consultation de dossier',
  'admin.user.suspend': 'Suspension',
  'admin.user.unsuspend': 'Levée de suspension',
  'admin.report.update': 'Traitement de signalement',
  'admin.venue.create': 'Création de complexe',
  'admin.venue.deactivate': 'Retrait de complexe',
  'admin.role.grant': 'Promotion administrateur',
  'admin.role.revoke': 'Révocation administrateur',
};

/**
 * B-06 : journal d'audit, en lecture seule.
 *
 * Aucune route ne cree, ne modifie ni ne supprime une ligne depuis
 * l'exterieur : un journal rectifiable ne prouve rien.
 */
const AdminAudit: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await api.get('/admin/audit-logs', {
        params: action ? { action } : undefined,
      });
      setLogs(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [action]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loading />;

  return (
    <div>
      <PageTitle subtitle="Lecture seule. Les actions sensibles y sont consignées.">
        Journal d'audit
      </PageTitle>

      {error && (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      <Field label="Filtrer par action" name="actionFilter">
        <select
          id="actionFilter" className={`${inputClass} mb-4`}
          value={action} onChange={(e) => setAction(e.target.value)}
        >
          <option value="">Toutes</option>
          {Object.entries(ACTIONS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      {logs.length === 0 ? (
        <Card>
          <p className="text-gray-600">Aucune entrée.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <Card key={log.id}>
              <p className="font-medium text-gray-900 text-sm">
                {ACTIONS[log.action] ?? log.action}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {log.actor?.email ?? 'ligne de commande'} ·{' '}
                {new Date(log.createdAt).toLocaleString('fr-FR')}
              </p>
              {log.targetId && (
                <p className="text-xs text-gray-500 mt-1 break-all">
                  {log.targetType} : {log.targetId}
                </p>
              )}
              {log.metadata && Object.keys(log.metadata).length > 0 && (
                <pre className="text-xs text-gray-600 mt-2 bg-gray-50 rounded p-2 overflow-x-auto">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminAudit;
