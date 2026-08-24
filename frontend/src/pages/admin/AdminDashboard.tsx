import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { Alert, Card, Loading, PageTitle } from '../../components/ui';

const Tile: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({
  label,
  value,
  hint,
}) => (
  <Card>
    <p className="text-sm text-gray-600">{label}</p>
    <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
  </Card>
);

/** B-01 : volumes et etats. Aucune donnee nominative sur cet ecran. */
const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get('/admin/stats')
      .then((res) => setStats(res.data))
      .catch((err) => setError(err.response?.data?.message ?? 'Chargement impossible'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (!stats) return <Alert kind="error">{error ?? 'Statistiques indisponibles'}</Alert>;

  const links = [
    { to: '/admin/signalements', label: 'Signalements', hint: `${stats.openReports} en attente` },
    { to: '/admin/comptes', label: 'Comptes', hint: 'Recherche et modération' },
    { to: '/admin/complexes', label: 'Complexes', hint: 'Catalogue partenaires' },
    { to: '/admin/journal', label: "Journal d'audit", hint: 'Actions sensibles' },
  ];

  return (
    <div>
      <PageTitle subtitle="Vue d'ensemble de la plateforme.">Back-office</PageTitle>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <Tile label="Comptes actifs" value={stats.users.active} hint={`${stats.users.total} au total`} />
        <Tile label="Groupes" value={stats.groups} />
        <Tile
          label="Sessions à venir"
          value={stats.events.upcoming}
          hint={`${stats.events.total} au total`}
        />
        <Tile label="Inscriptions confirmées" value={stats.confirmedInscriptions} />
      </div>

      {stats.openReports > 0 && (
        <div className="mb-6">
          <Alert kind="error">
            {stats.openReports} signalement{stats.openReports > 1 ? 's' : ''} en attente de
            traitement.
          </Alert>
        </div>
      )}

      <div className="space-y-3">
        {links.map((link) => (
          <Link key={link.to} to={link.to} className="block">
            <Card className="hover:border-green-400 transition">
              <p className="font-semibold text-gray-900">{link.label}</p>
              <p className="text-sm text-gray-600">{link.hint}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
