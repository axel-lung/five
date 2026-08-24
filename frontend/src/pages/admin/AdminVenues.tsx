import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { Alert, Button, Card, Field, inputClass, Loading, PageTitle } from '../../components/ui';

/**
 * PA-03 : catalogue des complexes.
 *
 * Alimente par le seul back-office : il engage la relation partenaire, il
 * n'est pas rempli par les joueurs. Le retrait desactive sans effacer, pour
 * ne pas perdre l'historique des sessions deja jouees.
 */
const AdminVenues: React.FC = () => {
  const [venues, setVenues] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', address: '', city: '', isPartner: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await api.get('/venues');
      setVenues(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const payload: Record<string, unknown> = { name: form.name, isPartner: form.isPartner };
      if (form.address) payload.address = form.address;
      if (form.city) payload.city = form.city;

      await api.post('/admin/venues', payload);
      setForm({ name: '', address: '', city: '', isPartner: false });
      setNotice('Complexe référencé.');
      await load();
    } catch (err: any) {
      const data = err.response?.data;
      setError(data?.details?.[0] ?? data?.message ?? 'Création impossible');
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (id: string, name: string) => {
    if (!window.confirm(`Retirer ${name} du catalogue ? Les sessions passées le conservent.`)) return;

    setBusy(true);
    try {
      await api.delete(`/admin/venues/${id}`);
      setNotice('Complexe retiré du catalogue.');
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Retrait impossible');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <PageTitle subtitle="Les lieux auxquels une session peut être rattachée.">
        Complexes
      </PageTitle>

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

      <Card className="mb-6">
        <h2 className="font-semibold text-gray-900 mb-3">Référencer un complexe</h2>

        <form onSubmit={create} className="space-y-3">
          <Field label="Nom" name="venueName">
            <input
              id="venueName" className={inputClass} required
              value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>

          <Field label="Ville" name="venueCity">
            <input
              id="venueCity" className={inputClass}
              value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
          </Field>

          <Field label="Adresse" name="venueAddress">
            <input
              id="venueAddress" className={inputClass}
              value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </Field>

          <label htmlFor="isPartner" className="flex items-center gap-3 min-h-[44px] text-sm text-gray-700">
            <input
              id="isPartner" type="checkbox" className="h-5 w-5"
              checked={form.isPartner}
              onChange={(e) => setForm((f) => ({ ...f, isPartner: e.target.checked }))}
            />
            <span>Partenaire sous contrat</span>
          </label>

          <Button type="submit" disabled={busy} full>
            Référencer
          </Button>
        </form>
      </Card>

      <h2 className="text-lg font-bold mb-3">Catalogue ({venues.length})</h2>

      {venues.length === 0 ? (
        <Card>
          <p className="text-gray-600">Aucun complexe référencé.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {venues.map((venue) => (
            <Card key={venue.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{venue.name}</p>
                  <p className="text-sm text-gray-600">
                    {[venue.address, venue.city].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                {venue.isPartner && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-800 shrink-0">
                    Partenaire
                  </span>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100">
                <Button
                  type="button" variant="secondary" disabled={busy}
                  onClick={() => deactivate(venue.id, venue.name)}
                >
                  Retirer du catalogue
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminVenues;
