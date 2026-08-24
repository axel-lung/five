import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { Alert, Button, Card, Field, inputClass, Loading, PageTitle } from '../../components/ui';

const STATUS_LABELS: Record<string, string> = {
  open: 'Ouverte',
  investigating: 'En cours',
  fixed: 'Corrigée',
  dismissed: 'Écartée',
};

const KIND_LABELS: Record<string, string> = {
  bug: 'Dysfonctionnement',
  display: 'Affichage',
  suggestion: 'Suggestion',
};

const SEVERITY_LABELS: Record<string, string> = {
  blocking: 'Bloquant',
  major: 'Gênant',
  minor: 'Mineur',
};

const SEVERITY_TONES: Record<string, string> = {
  blocking: 'bg-red-100 text-red-800',
  major: 'bg-orange-100 text-orange-800',
  minor: 'bg-gray-100 text-gray-700',
};

/** Beta : file des anomalies remontees par les testeurs. */
const AdminBugReports: React.FC = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [status, setStatus] = useState('open');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const response = await api.get('/admin/bug-reports', {
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
      await api.patch(`/admin/bug-reports/${id}`, {
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
      <PageTitle subtitle="Retours des bêta-testeurs, les plus graves en premier.">
        Anomalies
      </PageTitle>

      {error && (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      <Field label="Filtrer" name="bugStatusFilter">
        <select
          id="bugStatusFilter" className={`${inputClass} mb-4`}
          value={status} onChange={(e) => setStatus(e.target.value)}
        >
          <option value="open">Ouvertes</option>
          <option value="investigating">En cours</option>
          <option value="fixed">Corrigées</option>
          <option value="dismissed">Écartées</option>
          <option value="">Toutes</option>
        </select>
      </Field>

      {reports.length === 0 ? (
        <Card>
          <p className="text-gray-600">Aucune anomalie dans cette catégorie.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <Card key={report.id}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">
                    {KIND_LABELS[report.kind] ?? report.kind}
                  </p>
                  <p className="text-xs text-gray-500 break-all">
                    {report.context?.url ?? 'écran inconnu'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      SEVERITY_TONES[report.severity] ?? SEVERITY_TONES.minor
                    }`}
                  >
                    {SEVERITY_LABELS[report.severity] ?? report.severity}
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
                    {STATUS_LABELS[report.status] ?? report.status}
                  </span>
                </div>
              </div>

              <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">
                {report.description}
              </p>

              <p className="text-xs text-gray-500">
                Déclarée par {report.reporter?.email ?? 'compte supprimé'} le{' '}
                {new Date(report.createdAt).toLocaleDateString('fr-FR')}
              </p>

              {/* Le contexte technique est replie : il sert a reproduire, pas
                  a trier. */}
              {(report.context?.userAgent || report.context?.viewport) && (
                <details className="mt-2">
                  <summary className="text-xs text-gray-600 cursor-pointer min-h-[32px]">
                    Contexte technique
                  </summary>
                  <p className="text-xs text-gray-500 break-all mt-1">
                    {report.context.viewport && <>Fenêtre : {report.context.viewport}<br /></>}
                    {report.context.userAgent}
                  </p>
                </details>
              )}

              {report.resolutionNote && (
                <p className="text-sm text-gray-700 mt-3 pt-3 border-t border-gray-100">
                  Note : {report.resolutionNote}
                </p>
              )}

              {(report.status === 'open' || report.status === 'investigating') && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
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
                        onClick={() => decide(report.id, 'investigating')}
                      >
                        Prendre en charge
                      </Button>
                    )}
                    <Button type="button" disabled={busy} onClick={() => decide(report.id, 'fixed')}>
                      Corrigée
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

export default AdminBugReports;
