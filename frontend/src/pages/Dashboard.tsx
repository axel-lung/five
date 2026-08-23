import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

const Dashboard: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        // Get user info from localStorage (set during login)
        const userData = localStorage.getItem('user');
        if (userData) {
          setUser(JSON.parse(userData));
        }

        // Fetch user's groups
        const groupsResponse = await api.get('/groups');
        setGroups(groupsResponse.data);

        // Fetch upcoming events (open events)
        const eventsResponse = await api.get('/events');
        setEvents(eventsResponse.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-12">Loading...</div>;
  }

  if (error) {
    return <div className="text-center text-red-600 py-12">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Bonjour, {user?.firstName} !</h1>
          <p className="text-gray-600 mt-2">
            Voici votre tableau de bord Five/Futsal
          </p>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Mes groupes</h3>
            <p className="text-2xl font-bold text-blue-600">{groups.length}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Événements à venir</h3>
            <p className="text-2xl font-bold text-green-600">{events.length}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Profil</h3>
            <p className="text-2xl font-bold text-purple-600">
              {user?.emailVerified ? 'Vérifié' : 'Non vérifié'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-4">
            <Link
              to="/dashboard/create-group"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-md transition"
            >
              Créer un groupe
            </Link>
            <Link
              to="/dashboard/create-event"
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-md transition"
            >
              Créer un événement
            </Link>
          </div>
        </div>

        {/* My Groups */}
        <div className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Mes groupes</h2>
          {groups.length === 0 ? (
            <p className="text-gray-500">
              Vous n'avez pas encore créé de groupe. <Link to="/dashboard/create-group" className="text-blue-600 underline">Créez votre premier groupe</Link> !
            </p>
          ) : (
            <div className="space-y-4">
              {groups.map((group: any) => (
                <div key={group.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-800">{group.name}</h3>
                      <p className="text-sm text-gray-600">{group.city}</p>
                    </div>
                    <div className="text-right">
                      <Link
                        to={`/dashboard/group/${group.id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Voir le groupe
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Events */}
        <div className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Événements à venir</h2>
          {events.length === 0 ? (
            <p className="text-gray-500">
              Aucun événement à venir pour le moment. <Link to="/dashboard/create-event" className="text-blue-600 underline">Créez votre premier événement</Link> !
            </p>
          ) : (
            <div className="space-y-4">
              {events.map((event: any) => (
                <div key={event.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-800">{event.title}</h3>
                      <p className="text-sm text-gray-600">
                        {new Date(event.dateTime).toLocaleString('fr-FR', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {event.location} • {event.capacity} places
                      </p>
                    </div>
                    <div className="text-right">
                      <Link
                        to={`/dashboard/event/${event.id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Voir l'événement
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;