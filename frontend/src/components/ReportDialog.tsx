import React, { useState } from 'react';
import api from '../services/api';
import { Alert, Button, Card, Field, inputClass } from './ui';

/**
 * S-05 : signalement d'un compte, d'un groupe ou d'une session.
 *
 * Les motifs sont une liste fermee : un champ libre seul produit des
 * signalements inexploitables par la moderation, et le detail reste possible
 * a cote.
 */
const REASONS = [
  { value: 'spam', label: 'Spam ou publicité' },
  { value: 'harcelement', label: 'Harcèlement ou insultes' },
  { value: 'contenu-inapproprie', label: 'Contenu inapproprié' },
  { value: 'faux-profil', label: 'Faux profil' },
  { value: 'autre', label: 'Autre' },
];

type Props = {
  targetType: 'user' | 'group' | 'event';
  targetId: string;
  label?: string;
};

export const ReportDialog: React.FC<Props> = ({ targetType, targetId, label = 'Signaler' }) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0].value);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await api.post('/reports', {
        targetType,
        targetId,
        reason,
        ...(details ? { details } : {}),
      });
      setDone(true);
      setOpen(false);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Signalement impossible');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return <Alert kind="success">Signalement transmis à la modération.</Alert>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-gray-600 underline min-h-[44px]"
      >
        {label}
      </button>
    );
  }

  return (
    <Card>
      <h3 className="font-semibold text-gray-900 mb-3">Signaler</h3>

      {error && (
        <div className="mb-3">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        <Field label="Motif" name="reportReason">
          <select
            id="reportReason" className={inputClass}
            value={reason} onChange={(e) => setReason(e.target.value)}
          >
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Précisions" name="reportDetails" hint="Facultatif.">
          <textarea
            id="reportDetails" rows={3} className={inputClass}
            value={details} onChange={(e) => setDetails(e.target.value)}
          />
        </Field>

        <div className="flex gap-2">
          <Button type="submit" variant="danger" disabled={busy} full>
            {busy ? '…' : 'Envoyer'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)} full>
            Annuler
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default ReportDialog;
