import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { currentUser } from '../services/api';
import { Alert, Card, formatDateTime, Loading, PageTitle, StatusBadge } from '../components/ui';

const Dashboard: React.FC = () => {
  const [groups, setGroups] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = currentUser();

  useEffect(() => {
    const load = async () => {
      try {
        const [groupsRes, eventsRes] = await Promise.all([
          api.get('/groups'),
          api.get('/events'),
        ]);
        setGroups(groupsRes.data);
        setEvents(eventsRes.data);
      } catch (err: any) {
        setError(err.response?.data?.message ?? 'Chargement impossible');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) return <Loading />;

  return (
    <div>
      <PageTitle subtitle="Vos groupes et vos prochaines sessions.">
        Bonjour {user?.firstName ?? ''}
      </PageTitle>

      {error && (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        <Link
          to="/events/new"
          className="min-h-[44px] flex items-center justify-center rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition"
        >
          Créer une session
        </Link>
        <Link
          to="/groups/new"
          className="min-h-[44px] flex items-center justify-center rounded-lg bg-white border border-gray-300 hover:bg-gray-50 font-semibold transition"
        >
          Créer un groupe
        </Link>
      </div>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">Prochaines sessions</h2>
        {events.length === 0 ? (
          <Card>
            <p className="text-gray-600">
              Aucune session à venir.{' '}
              <Link to="/events/new" className="text-green-700 underline font-medium">
                Créez la première
              </Link>
              .
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <Link key={event.id} to={`/events/${event.id}`} className="block">
                <Card className="hover:border-green-400 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{event.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{formatDateTime(event.dateTime)}</p>
                      {event.location && (
                        <p className="text-sm text-gray-500 mt-0.5 truncate">{event.location}</p>
                      )}
                    </div>
                    <StatusBadge status={event.status} />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-bold mb-3">Mes groupes</h2>
        {groups.length === 0 ? (
          <Card>
            <p className="text-gray-600">
              Vous n'êtes dans aucun groupe.{' '}
              <Link to="/groups/new" className="text-green-700 underline font-medium">
                Créez le vôtre
              </Link>
              .
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <Link key={group.id} to={`/groups/${group.id}`} className="block">
                <Card className="hover:border-green-400 transition">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{group.name}</h3>
                      {group.city && <p className="text-sm text-gray-600">{group.city}</p>}
                    </div>
                    {!group.isMember && (
                      <span className="text-xs text-gray-500 shrink-0">Public</span>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
