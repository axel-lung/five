import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { Alert, Card, Loading, PageTitle } from '../components/ui';

const Groups: React.FC = () => {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get('/groups')
      .then((res) => setGroups(res.data))
      .catch((err) => setError(err.response?.data?.message ?? 'Chargement impossible'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  const mine = groups.filter((g) => g.isMember);
  const others = groups.filter((g) => !g.isMember);

  return (
    <div>
      <PageTitle subtitle="Vos groupes, et les groupes publics près de chez vous.">
        Groupes
      </PageTitle>

      {error && (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      <Link
        to="/groupes/nouveau"
        className="min-h-[44px] flex items-center justify-center rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition mb-6"
      >
        Créer un groupe
      </Link>

      {mine.length === 0 && others.length === 0 ? (
        <Card>
          <p className="text-gray-600">
            Aucun groupe pour l'instant. Créez le vôtre, ou demandez un lien d'invitation
            à un organisateur.
          </p>
        </Card>
      ) : (
        <>
          {mine.length > 0 && (
            <section className="mb-8">
              <h2 className="text-lg font-bold mb-3">Mes groupes</h2>
              <div className="space-y-3">
                {mine.map((group) => (
                  <Link key={group.id} to={`/groupes/${group.id}`} className="block">
                    <Card className="hover:border-green-400 transition">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-gray-900">{group.name}</h3>

                        {/* S-01 : messages non lus du chat de ce groupe. */}
                        {group.unreadCount > 0 && (
                          <span
                            className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-600 text-white
                                       text-xs font-bold flex items-center justify-center shrink-0"
                            aria-label={`${group.unreadCount} messages non lus`}
                          >
                            {group.unreadCount > 99 ? '99+' : group.unreadCount}
                          </span>
                        )}
                      </div>
                      {group.city && <p className="text-sm text-gray-600">{group.city}</p>}
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {others.length > 0 && (
            <section>
              <h2 className="text-lg font-bold mb-3">Groupes publics</h2>
              <div className="space-y-3">
                {others.map((group) => (
                  <Link key={group.id} to={`/groupes/${group.id}`} className="block">
                    <Card className="hover:border-green-400 transition">
                      <h3 className="font-semibold text-gray-900">{group.name}</h3>
                      {group.city && <p className="text-sm text-gray-600">{group.city}</p>}
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default Groups;
