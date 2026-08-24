import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Alert, Button, Card, Field, inputClass, Loading, PageTitle } from '../components/ui';

/** N-04 : canaux et heures de silence. */
const NotificationPreferences: React.FC = () => {
  const [prefs, setPrefs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api
      .get('/notifications/preferences')
      .then((res) => setPrefs(res.data))
      .catch((err) => setError(err.response?.data?.message ?? 'Chargement impossible'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (!prefs) return <Alert kind="error">{error ?? 'Préférences introuvables'}</Alert>;

  const set = (patch: Record<string, unknown>) => setPrefs((p: any) => ({ ...p, ...patch }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await api.put('/notifications/preferences', {
        pushEnabled: prefs.pushEnabled,
        emailEnabled: prefs.emailEnabled,
        // null est une valeur voulue — « pas d'heures de silence » — et se
        // distingue d'un champ absent, que l'API laisserait inchange.
        quietHoursStart: prefs.quietHoursStart,
        quietHoursEnd: prefs.quietHoursEnd,
      });
      setPrefs(response.data);
      setNotice('Préférences enregistrées.');
    } catch (err: any) {
      const data = err.response?.data;
      setError(data?.details?.[0] ?? data?.message ?? 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  const hours = Array.from({ length: 24 }, (_, h) => h);

  return (
    <div className="max-w-md mx-auto">
      <PageTitle subtitle="Ce que vous recevez, et quand.">Préférences</PageTitle>

      {notice && (
        <div className="mb-4">
          <Alert kind="success">{notice}</Alert>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      <form onSubmit={save} className="space-y-4">
        <Card>
          <label htmlFor="pushEnabled" className="flex items-center justify-between gap-3 min-h-[44px]">
            <span className="text-sm font-medium text-gray-800">Notifications push</span>
            <input
              id="pushEnabled" type="checkbox" className="h-5 w-5"
              checked={prefs.pushEnabled}
              onChange={(e) => set({ pushEnabled: e.target.checked })}
            />
          </label>

          <label htmlFor="emailEnabled" className="flex items-center justify-between gap-3 min-h-[44px]">
            <span className="text-sm font-medium text-gray-800">Emails</span>
            <input
              id="emailEnabled" type="checkbox" className="h-5 w-5"
              checked={prefs.emailEnabled}
              onChange={(e) => set({ emailEnabled: e.target.checked })}
            />
          </label>
        </Card>

        <Card>
          <h2 className="font-semibold text-gray-900 mb-1">Heures de silence</h2>
          <p className="text-sm text-gray-600 mb-3">
            Aucune notification pendant cette plage. Laissez vide pour ne rien silencier.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Field label="De" name="quietHoursStart">
              <select
                id="quietHoursStart" className={inputClass}
                value={prefs.quietHoursStart ?? ''}
                onChange={(e) =>
                  set({ quietHoursStart: e.target.value === '' ? null : Number(e.target.value) })
                }
              >
                <option value="">—</option>
                {hours.map((h) => (
                  <option key={h} value={h}>{`${String(h).padStart(2, '0')}:00`}</option>
                ))}
              </select>
            </Field>

            <Field label="À" name="quietHoursEnd">
              <select
                id="quietHoursEnd" className={inputClass}
                value={prefs.quietHoursEnd ?? ''}
                onChange={(e) =>
                  set({ quietHoursEnd: e.target.value === '' ? null : Number(e.target.value) })
                }
              >
                <option value="">—</option>
                {hours.map((h) => (
                  <option key={h} value={h}>{`${String(h).padStart(2, '0')}:00`}</option>
                ))}
              </select>
            </Field>
          </div>
        </Card>

        <Button type="submit" disabled={saving} full>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </form>
    </div>
  );
};

export default NotificationPreferences;
