import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { Alert, Button, Card, Loading, PageTitle } from '../components/ui';

/**
 * N-05 : centre de notifications.
 *
 * Chaque type est traduit ici plutot que cote serveur : le libelle est de
 * l'affichage, et le faire voyager dans le payload obligerait a migrer la
 * base pour corriger une faute de frappe.
 */
const LABELS: Record<string, (payload: any) => string> = {
  'event.opened': (p) => `${p.title} est ouverte aux inscriptions`,
  'event.updated': (p) => `${p.title} a changé d'horaire ou de lieu`,
  'event.cancelled': (p) => `${p.title} a été annulée`,
  'event.spot_released': (p) => `Une place s'est libérée pour ${p.title} — vous êtes confirmé`,
  'event.reminder': (p) => `${p.title} : l'organisateur attend votre réponse`,
  'event.ownership_transferred': (p) => `Vous organisez désormais ${p.title}`,
};

const describe = (notification: any) => {
  const build = LABELS[notification.type];
  return build ? build(notification.payload ?? {}) : notification.type;
};

const relative = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
};

const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await api.get('/notifications', {
        params: onlyUnread ? { unread: 'true' } : undefined,
      });
      setNotifications(response.data.notifications);
      setUnread(response.data.unreadCount);
      // Rafraichit le badge de la navigation, qui vit hors de cet ecran.
      window.dispatchEvent(new Event('notifications:refresh'));
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [onlyUnread]);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id: string) => {
    await api.patch(`/notifications/${id}/read`).catch(() => undefined);
    await load();
  };

  const markAllRead = async () => {
    await api.post('/notifications/read-all').catch(() => undefined);
    await load();
  };

  if (loading) return <Loading />;

  return (
    <div>
      <PageTitle subtitle={unread > 0 ? `${unread} non lue${unread > 1 ? 's' : ''}` : 'Tout est lu.'}>
        Notifications
      </PageTitle>

      {error && (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setOnlyUnread((v) => !v)}
          aria-pressed={onlyUnread}
        >
          {onlyUnread ? 'Voir tout' : 'Non lues seulement'}
        </Button>

        {unread > 0 && (
          <Button type="button" variant="secondary" onClick={markAllRead}>
            Tout marquer comme lu
          </Button>
        )}

        <Link
          to="/notifications/preferences"
          className="min-h-[44px] flex items-center px-5 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 font-semibold transition"
        >
          Préférences
        </Link>
      </div>

      {notifications.length === 0 ? (
        <Card>
          <p className="text-gray-600">
            {onlyUnread ? 'Aucune notification non lue.' : 'Aucune notification.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => {
            const target = notification.payload?.eventId
              ? `/sessions/${notification.payload.eventId}`
              : null;

            const body = (
              <Card
                className={`transition ${
                  notification.readAt ? 'opacity-70' : 'border-green-300 bg-green-50/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  {!notification.readAt && (
                    <span
                      className="mt-1.5 w-2 h-2 rounded-full bg-green-600 shrink-0"
                      aria-label="Non lue"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900">{describe(notification)}</p>
                    <p className="text-xs text-gray-500 mt-1">{relative(notification.createdAt)}</p>
                  </div>
                </div>
              </Card>
            );

            return (
              <div key={notification.id}>
                {target ? (
                  <Link to={target} onClick={() => markRead(notification.id)} className="block">
                    {body}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => markRead(notification.id)}
                    className="block w-full text-left"
                  >
                    {body}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Notifications;
