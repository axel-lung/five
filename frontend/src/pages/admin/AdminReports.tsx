import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { Alert, Button, Card, Field, inputClass, Loading, PageTitle } from '../../components/ui';

const STATUS_LABELS: Record<string, string> = {
  open: 'Ouvert',
  reviewing: 'En cours',
  resolved: 'Traité',
  dismissed: 'Écarté',
};

const TARGET_LABELS: Record<string, string> = {
  user: 'Joueur',
  group: 'Groupe',
  event: 'Session',
};

/** B-02 : file de moderation. */
const AdminReports: React.FC = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [status, setStatus] = useState('open');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const response = await api.get('/admin/reports', {
        params: status ? { status } : undefined,
      });
      setReports(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (id: string, next: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/admin/reports/${id}`, {
        status: next,
        ...(notes[id] ? { resolutionNote: notes[id] } : {}),
      });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Traitement impossible');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <PageTitle subtitle="Chaque décision est journalisée.">Signalements</PageTitle>

      {error && (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      <Field label="Filtrer" name="statusFilter">
        <select
          id="statusFilter" className={`${inputClass} mb-4`}
          value={status} onChange={(e) => setStatus(e.target.value)}
        >
          <option value="open">Ouverts</option>
          <option value="reviewing">En cours</option>
          <option value="resolved">Traités</option>
          <option value="dismissed">Écartés</option>
          <option value="">Tous</option>
        </select>
      </Field>

      {reports.length === 0 ? (
        <Card>
          <p className="text-gray-600">Aucun signalement dans cette catégorie.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <Card key={report.id}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">
                    {TARGET_LABELS[report.targetType] ?? report.targetType} — {report.reason}
                  </p>
                  <p className="text-xs text-gray-500 break-all">{report.targetId}</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 shrink-0">
                  {STATUS_LABELS[report.status] ?? report.status}
                </span>
              </div>

              {report.details && <p className="text-sm text-gray-700 mb-2">{report.details}</p>}

              <p className="text-xs text-gray-500 mb-3">
                Signalé par {report.reporter?.email ?? 'compte supprimé'} le{' '}
                {new Date(report.createdAt).toLocaleDateString('fr-FR')}
              </p>

              {report.resolutionNote && (
                <p className="text-sm text-gray-700 mb-3 pt-3 border-t border-gray-100">
                  Note : {report.resolutionNote}
                </p>
              )}

              {(report.status === 'open' || report.status === 'reviewing') && (
                <div className="pt-3 border-t border-gray-100 space-y-2">
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="Note de traitement (facultatif)"
                    aria-label="Note de traitement"
                    value={notes[report.id] ?? ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [report.id]: e.target.value }))}
                  />

                  <div className="flex flex-wrap gap-2">
                    {report.status === 'open' && (
                      <Button
                        type="button" variant="secondary" disabled={busy}
                        onClick={() => decide(report.id, 'reviewing')}
                      >
                        Prendre en charge
                      </Button>
                    )}
                    <Button type="button" disabled={busy} onClick={() => decide(report.id, 'resolved')}>
                      Traiter
                    </Button>
                    <Button
                      type="button" variant="secondary" disabled={busy}
                      onClick={() => decide(report.id, 'dismissed')}
                    >
                      Écarter
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminReports;
