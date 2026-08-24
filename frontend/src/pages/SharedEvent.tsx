import React, { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import api from '../services/api';
import { Alert, Card, formatDateTime, Loading, PageTitle, StatusBadge } from '../components/ui';

/**
 * E-07 : resume public d'une session, puis conversion a l'inscription.
 *
 * Aucune donnee personnelle des participants n'est exposee ici — l'API n'en
 * renvoie pas. Le joueur voit de quoi decider, et cree un compte s'il vient.
 */
const SharedEvent: React.FC = () => {
  const { token } = useParams();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const connected = Boolean(localStorage.getItem('access_token'));

  useEffect(() => {
    api
      .get(`/events/shared/${token}`)
      .then((res) => setEvent(res.data))
      .catch((err) => setError(err.response?.data?.message ?? 'Session introuvable'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <Loading />;
  if (error) return <Alert kind="error">{error}</Alert>;

  return (
    <div className="max-w-md mx-auto py-6">
      <div className="flex items-start justify-between gap-3">
        <PageTitle
          subtitle={event.organizer ? `Organisé par ${event.organizer.firstName}` : undefined}
        >
          {event.title}
        </PageTitle>
        <StatusBadge status={event.status} />
      </div>

      <Card className="mb-4">
        <dl className="space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="text-gray-500 w-20 shrink-0">Quand</dt>
            <dd className="font-medium text-gray-900">{formatDateTime(event.dateTime)}</dd>
          </div>
          {event.location && (
            <div className="flex gap-2">
              <dt className="text-gray-500 w-20 shrink-0">Où</dt>
              <dd className="font-medium text-gray-900">{event.location}</dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="text-gray-500 w-20 shrink-0">Places</dt>
            <dd className="font-medium text-gray-900">
              {event.confirmedCount} / {event.capacity}
              {event.spotsLeft > 0 ? (
                <span className="text-gray-500 font-normal">
                  {' '}
                  — {event.spotsLeft} restante{event.spotsLeft > 1 ? 's' : ''}
                </span>
              ) : (
                <span className="text-orange-700 font-normal"> — liste d'attente</span>
              )}
            </dd>
          </div>
          {event.price != null && (
            <div className="flex gap-2">
              <dt className="text-gray-500 w-20 shrink-0">Prix</dt>
              <dd className="font-medium text-gray-900">{event.price} €</dd>
            </div>
          )}
        </dl>

        {event.description && (
          <p className="text-sm text-gray-700 mt-4 pt-4 border-t border-gray-100">
            {event.description}
          </p>
        )}
      </Card>

      {connected ? (
        <Link
          to={`/sessions/${event.id}`}
          className="min-h-[44px] flex items-center justify-center rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition"
        >
          Voir la session et m'inscrire
        </Link>
      ) : (
        <div className="space-y-3">
          <Link
            to="/register"
            state={{ from: { pathname: `/sessions/${event.id}` } }}
            className="min-h-[44px] flex items-center justify-center rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition"
          >
            Créer un compte pour participer
          </Link>
          <Link
            to="/login"
            state={{ from: { pathname: `/sessions/${event.id}` } }}
            className="min-h-[44px] flex items-center justify-center rounded-lg bg-white border border-gray-300 hover:bg-gray-50 font-semibold transition"
          >
            J'ai déjà un compte
          </Link>
        </div>
      )}
    </div>
  );
};

export default SharedEvent;
