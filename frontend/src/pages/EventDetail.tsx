import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api, { currentUser } from '../services/api';
import ShareButton from '../components/ShareButton';
import {
  Alert,
  Button,
  Card,
  formatDateTime,
  Loading,
  PageTitle,
  StatusBadge,
} from '../components/ui';

/**
 * Parcours critique « s'inscrire a une session » (E-03).
 *
 * Le statut de chaque joueur voyage dans la table de liaison, exposee par
 * Sequelize sous la cle `EventInscription`. C'est elle qui distingue un
 * confirme d'un joueur en liste d'attente, sans appel supplementaire.
 */
type Participant = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  EventInscription?: { status: string };
};

const displayName = (player: Participant) =>
  [player.firstName, player.lastName].filter(Boolean).join(' ') || 'Compte supprimé';

const EventDetail: React.FC = () => {
  const { eventId } = useParams();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const me = currentUser();

  const load = useCallback(async () => {
    try {
      const response = await api.get(`/events/${eventId}`);
      setEvent(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Session introuvable');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loading />;
  if (error && !event) return <Alert kind="error">{error}</Alert>;

  const participants: Participant[] = event.participants ?? [];
  const active = participants.filter((p) => p.EventInscription?.status !== 'cancelled');
  const confirmed = active.filter((p) => p.EventInscription?.status === 'confirmed');
  const waitlist = active.filter((p) => p.EventInscription?.status === 'waitlist');

  const mine = active.find((p) => p.id === me?.id);
  const myStatus = mine?.EventInscription?.status ?? null;
  const isOrganizer = event.organizerId === me?.id;
  const spotsLeft = Math.max(0, event.capacity - confirmed.length);
  const closed = event.status === 'cancelled' || event.status === 'completed';

  const act = async (action: 'join' | 'leave') => {
    setActing(true);
    setError(null);
    setNotice(null);

    try {
      const response = await api.post(`/events/${eventId}/${action}`);

      if (action === 'join') {
        setNotice(
          response.data.status === 'waitlist'
            ? "La session est complète : vous êtes en liste d'attente. Vous serez prévenu si une place se libère."
            : 'Votre place est confirmée.'
        );
      } else {
        setNotice(
          response.data.promotedUserId
            ? "Vous vous êtes désisté. Le premier de la liste d'attente prend votre place."
            : 'Vous vous êtes désisté.'
        );
      }

      await load();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Action impossible');
    } finally {
      setActing(false);
    }
  };

  const cancelEvent = async () => {
    if (!window.confirm('Annuler cette session ? Les inscrits seront prévenus.')) return;

    setActing(true);
    try {
      await api.patch(`/events/${eventId}/status`, { status: 'cancelled' });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Annulation impossible');
    } finally {
      setActing(false);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-1">
        <PageTitle>{event.title}</PageTitle>
        <StatusBadge status={event.status} />
      </div>

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

      <Card className="mb-4">
        <dl className="space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="text-gray-500 w-20 shrink-0">Quand</dt>
            <dd className="font-medium text-gray-900">{formatDateTime(event.dateTime)}</dd>
          </div>
          {(event.venue || event.location) && (
            <div className="flex gap-2">
              <dt className="text-gray-500 w-20 shrink-0">Où</dt>
              <dd className="font-medium text-gray-900">
                {event.venue?.name ?? event.location}
              </dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="text-gray-500 w-20 shrink-0">Places</dt>
            <dd className="font-medium text-gray-900">
              {confirmed.length} / {event.capacity}
              {spotsLeft > 0 && event.status === 'open' && (
                <span className="text-gray-500 font-normal">
                  {' '}
                  — {spotsLeft} restante{spotsLeft > 1 ? 's' : ''}
                </span>
              )}
            </dd>
          </div>
          {event.price != null && (
            <div className="flex gap-2">
              <dt className="text-gray-500 w-20 shrink-0">Prix</dt>
              <dd className="font-medium text-gray-900">{event.price} €</dd>
            </div>
          )}
          {event.organizer && (
            <div className="flex gap-2">
              <dt className="text-gray-500 w-20 shrink-0">Organisé</dt>
              <dd className="font-medium text-gray-900">par {event.organizer.firstName}</dd>
            </div>
          )}
        </dl>

        {event.description && (
          <p className="text-sm text-gray-700 mt-4 pt-4 border-t border-gray-100">
            {event.description}
          </p>
        )}
      </Card>

      {!closed && (
        <div className="mb-4">
          {myStatus ? (
            <>
              {myStatus === 'waitlist' && !notice && (
                <div className="mb-3">
                  <Alert>Vous êtes en liste d'attente.</Alert>
                </div>
              )}
              <Button variant="secondary" onClick={() => act('leave')} disabled={acting} full>
                {acting ? '…' : 'Me désister'}
              </Button>
            </>
          ) : (
            <Button onClick={() => act('join')} disabled={acting} full>
              {acting
                ? '…'
                : spotsLeft > 0
                  ? 'Je participe'
                  : "Rejoindre la liste d'attente"}
            </Button>
          )}
        </div>
      )}

      {/* S-03 : le lien partageable se consulte sans compte (E-07). */}
      {event.shareableLinkToken && (
        <Card className="mb-4">
          <h2 className="font-semibold text-gray-900 mb-3">Partager la session</h2>
          <ShareButton
            url={`/e/${event.shareableLinkToken}`}
            text={`${event.title} — ${formatDateTime(event.dateTime)}`}
          />
        </Card>
      )}

      <section className="mb-4">
        <h2 className="text-lg font-bold mb-3">
          Confirmés ({confirmed.length})
        </h2>
        {confirmed.length === 0 ? (
          <Card>
            <p className="text-gray-600 text-sm">Personne pour l'instant.</p>
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-gray-100">
              {confirmed.map((player) => (
                <li key={player.id} className="py-2 text-sm text-gray-800">
                  {displayName(player)}
                  {player.id === me?.id && <span className="text-gray-400"> — vous</span>}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {waitlist.length > 0 && (
        <section className="mb-4">
          <h2 className="text-lg font-bold mb-3">Liste d'attente ({waitlist.length})</h2>
          <Card>
            <ol className="divide-y divide-gray-100">
              {waitlist.map((player, index) => (
                <li key={player.id} className="py-2 text-sm text-gray-800">
                  <span className="text-gray-400 mr-2">{index + 1}.</span>
                  {displayName(player)}
                  {player.id === me?.id && <span className="text-gray-400"> — vous</span>}
                </li>
              ))}
            </ol>
          </Card>
        </section>
      )}

      {isOrganizer && !closed && (
        <Button variant="danger" onClick={cancelEvent} disabled={acting} full>
          Annuler la session
        </Button>
      )}
    </div>
  );
};

export default EventDetail;
