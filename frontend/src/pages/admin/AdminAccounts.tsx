import React, { useState } from 'react';
import api from '../../services/api';
import { Alert, Button, Card, inputClass, PageTitle } from '../../components/ui';

/**
 * B-03 : recherche d'un compte pour le support. B-02 : suspension.
 *
 * Chaque recherche et chaque consultation est journalisee cote serveur :
 * acceder au dossier d'un joueur est en soi une action sensible.
 */
const AdminAccounts: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const response = await api.get('/admin/users', { params: { q: query } });
      setResults(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Recherche impossible');
      setResults(null);
    } finally {
      setBusy(false);
    }
  };

  const suspend = async (userId: string, email: string) => {
    const reason = window.prompt(`Motif de la suspension de ${email} ?`);
    if (!reason) return;

    setBusy(true);
    setError(null);
    try {
      await api.post(`/admin/users/${userId}/suspend`, { reason });
      setNotice('Compte suspendu.');
      setResults((rows) =>
        rows?.map((r) => (r.id === userId ? { ...r, suspendedAt: new Date().toISOString(), suspensionReason: reason } : r)) ?? null
      );
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Suspension impossible');
    } finally {
      setBusy(false);
    }
  };

  const unsuspend = async (userId: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/admin/users/${userId}/unsuspend`);
      setNotice('Suspension levée.');
      setResults((rows) =>
        rows?.map((r) => (r.id === userId ? { ...r, suspendedAt: null, suspensionReason: null } : r)) ?? null
      );
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Levée impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageTitle subtitle="Recherche par email, prénom ou nom.">Comptes</PageTitle>

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

      <form onSubmit={search} className="flex gap-2 mb-6">
        <input
          id="adminQuery" type="search" className={inputClass}
          placeholder="Deux caractères minimum"
          aria-label="Rechercher un compte"
          value={query} onChange={(e) => setQuery(e.target.value)}
        />
        <Button type="submit" disabled={busy}>
          Chercher
        </Button>
      </form>

      {results && results.length === 0 && (
        <Card>
          <p className="text-gray-600">Aucun compte ne correspond.</p>
        </Card>
      )}

      {results && results.length > 0 && (
        <div className="space-y-3">
          {results.map((user) => (
            <Card key={user.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {[user.firstName, user.lastName].filter(Boolean).join(' ') || '—'}
                  </p>
                  <p className="text-sm text-gray-600 break-all">{user.email}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Inscrit le {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                    {user.role === 'admin' && ' · administrateur'}
                  </p>
                </div>

                {user.deletedAt ? (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 shrink-0">
                    Effacé
                  </span>
                ) : user.suspendedAt ? (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-800 shrink-0">
                    Suspendu
                  </span>
                ) : null}
              </div>

              {user.suspensionReason && (
                <p className="text-sm text-gray-700 mt-2">Motif : {user.suspensionReason}</p>
              )}

              {!user.deletedAt && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  {user.suspendedAt ? (
                    <Button type="button" variant="secondary" disabled={busy} onClick={() => unsuspend(user.id)}>
                      Lever la suspension
                    </Button>
                  ) : (
                    <Button type="button" variant="danger" disabled={busy} onClick={() => suspend(user.id, user.email)}>
                      Suspendre
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminAccounts;
