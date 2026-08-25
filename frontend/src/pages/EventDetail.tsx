import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { currentUser } from '../services/api';
import ShareButton from '../components/ShareButton';
import ReportDialog from '../components/ReportDialog';
import {
  Alert,
  Button,
  Card,
  Field,
  formatDateTime,
  inputClass,
  Loading,
  PageTitle,
  StatusBadge,
} from '../components/ui';

/** Valeur attendue par <input type="datetime-local">, en heure locale. */
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

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
  const [editing, setEditing] = useState(false);
  const [duplicateDate, setDuplicateDate] = useState('');
  // Choix du successeur : ouvert soit pour un depart (« leave »), soit pour une
  // transmission seule (« transfer »). Le meme panneau sert aux deux.
  const [handover, setHandover] = useState<'leave' | 'transfer' | null>(null);
  const [successorId, setSuccessorId] = useState('');
  const me = currentUser();
  const navigate = useNavigate();

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

  /**
   * Les joueurs a qui l'organisation peut etre leguee. Les confirmes d'abord :
   * ce sont eux qui seront sur le terrain. La liste d'attente reste eligible,
   * sinon un organisateur dont tous les confirmes se sont desistes n'aurait
   * plus personne a qui passer la main.
   */
  const successors = [...confirmed, ...waitlist].filter((p) => p.id !== me?.id);

  const act = async (action: 'join' | 'withdraw') => {
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
      // L'API repond 404 quand un blocage existe, pour ne pas le reveler.
      // On garde ce silence tout en restant lisible en francais.
      setError(
        err.response?.status === 404
          ? "Cette session n'est plus disponible."
          : (err.response?.data?.message ?? 'Action impossible')
      );
    } finally {
      setActing(false);
    }
  };

  /** Suppression sans confirmation : les appelants demandent la leur. */
  const destroyEvent = async () => {
    await api.delete(`/events/${eventId}`);
    navigate('/dashboard', { replace: true });
  };

  /**
   * E-03 : quitter la session pour de bon.
   *
   * L'organisateur ne part pas les mains vides : l'API refuse tant qu'il n'a
   * pas designe de successeur, et lui propose la suppression s'il est le
   * dernier. Les deux refus arrivent avec un `reason`, ce qui evite de deviner
   * le cas a partir du message.
   */
  const leaveSession = async (newOrganizerId?: string) => {
    setActing(true);
    setError(null);
    setNotice(null);

    try {
      const response = await api.post(
        `/events/${eventId}/leave`,
        newOrganizerId ? { newOrganizerId } : {}
      );

      setHandover(null);
      setSuccessorId('');

      if (response.data.newOrganizerId) {
        const successor = successors.find((p) => p.id === response.data.newOrganizerId);
        setNotice(
          `Vous avez quitté la session. ${successor ? displayName(successor) : 'Un autre joueur'} en est désormais l'organisateur.`
        );
      } else {
        setNotice('Vous avez quitté la session.');
      }

      await load();
    } catch (err: any) {
      const reason = err.response?.data?.reason;

      if (reason === 'ORGANIZER_MUST_TRANSFER') {
        setHandover('leave');
      } else if (reason === 'ORGANIZER_ALONE') {
        // Seul dans sa propre session : il n'y a personne a qui la transmettre,
        // et la garder ne servirait a personne.
        if (
          window.confirm(
            'Vous êtes seul dans cette session. La quitter revient à la supprimer. Confirmer ?'
          )
        ) {
          await destroyEvent();
        }
      } else {
        setError(err.response?.data?.message ?? 'Action impossible');
      }
    } finally {
      setActing(false);
    }
  };

  /** E-02 : passer la main tout en restant joueur. */
  const transferOwnership = async (newOrganizerId: string) => {
    setActing(true);
    setError(null);
    setNotice(null);

    try {
      await api.post(`/events/${eventId}/transfer-ownership`, { newOrganizerId });
      const successor = successors.find((p) => p.id === newOrganizerId);
      setHandover(null);
      setSuccessorId('');
      setNotice(
        `${successor ? displayName(successor) : 'Le joueur choisi'} organise désormais cette session.`
      );
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Transmission impossible');
    } finally {
      setActing(false);
    }
  };

  /**
   * N-03 : relancer les membres du groupe qui n'ont pas repondu.
   *
   * Le plafond quotidien renvoie 429. Ce n'est pas une panne mais une regle
   * du produit : on l'affiche comme une information, pas comme une erreur.
   */
  const remind = async () => {
    setActing(true);
    setError(null);
    setNotice(null);

    try {
      const response = await api.post(`/events/${eventId}/remind`);
      setNotice(
        response.data.recipientCount > 0
          ? `Relance envoyée à ${response.data.recipientCount} joueur${response.data.recipientCount > 1 ? 's' : ''}.`
          : 'Tout le monde a déjà répondu.'
      );
    } catch (err: any) {
      if (err.response?.status === 429) {
        setNotice('Une relance a déjà été envoyée aujourd\'hui pour cette session.');
      } else {
        setError(err.response?.data?.message ?? 'Relance impossible');
      }
    } finally {
      setActing(false);
    }
  };

  /** E-02 : transitions pilotees par l'organisateur. */
  const setStatus = async (status: string, confirmMessage?: string) => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;

    setActing(true);
    setError(null);
    setNotice(null);
    try {
      await api.patch(`/events/${eventId}/status`, { status });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Changement de statut impossible');
    } finally {
      setActing(false);
    }
  };

  /**
   * E-04 : recurrence par duplication.
   *
   * La copie nait en brouillon et sans inscription : c'est la validation
   * humaine qu'exige le CCH.md, et reconduire les inscrits reviendrait a les
   * engager sans leur demander.
   */
  const duplicate = async () => {
    if (!duplicateDate) return;

    setActing(true);
    setError(null);
    try {
      const response = await api.post(`/events/${eventId}/duplicate`, {
        dateTime: new Date(duplicateDate).toISOString(),
      });
      navigate(`/sessions/${response.data.id}`);
    } catch (err: any) {
      const data = err.response?.data;
      setError(data?.details?.[0] ?? data?.message ?? 'Duplication impossible');
    } finally {
      setActing(false);
    }
  };

  const saveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setActing(true);
    setError(null);
    setNotice(null);

    try {
      const payload: Record<string, unknown> = {
        title: event.title,
        dateTime: new Date(event.dateTime).toISOString(),
        capacity: Number(event.capacity),
      };
      if (event.location) payload.location = event.location;
      if (event.description) payload.description = event.description;
      if (event.price != null && event.price !== '') payload.price = Number(event.price);
      if (event.groupId) payload.groupId = event.groupId;
      if (event.venueId) payload.venueId = event.venueId;

      await api.put(`/events/${eventId}`, payload);
      setEditing(false);
      await load();
      setNotice('Session mise à jour.');
    } catch (err: any) {
      const data = err.response?.data;
      setError(data?.details?.[0] ?? data?.message ?? 'Enregistrement impossible');
    } finally {
      setActing(false);
    }
  };

  const removeEvent = async () => {
    if (!window.confirm('Supprimer cette session ? Les inscriptions seront perdues.')) return;

    setActing(true);
    try {
      await destroyEvent();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Suppression impossible');
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

  /**
   * Le meme panneau sert au depart et a la transmission seule. Il est rendu la
   * ou l'action a ete declenchee — sous le bouton « Quitter la session » ou
   * dans le bloc Organisation — pour ne pas apparaitre hors de l'ecran.
   */
  const handoverPanel = (
    <Card className="mb-4">
      <h2 className="font-semibold text-gray-900 mb-1">
        {handover === 'leave' ? 'À qui laissez-vous la session ?' : "Transmettre l'organisation"}
      </h2>
      <p className="text-sm text-gray-600 mb-3">
        {handover === 'leave'
          ? 'Vous organisez cette session : désignez qui la reprend avant de partir.'
          : "Vous gardez votre place de joueur ; c'est l'organisation qui change de mains."}
      </p>

      <Field label="Nouvel organisateur" name="successor">
        <select
          id="successor"
          className={inputClass}
          value={successorId}
          onChange={(e) => setSuccessorId(e.target.value)}
        >
          <option value="">Choisir un joueur…</option>
          {successors.map((player) => (
            <option key={player.id} value={player.id}>
              {displayName(player)}
              {player.EventInscription?.status === 'waitlist' ? " (liste d'attente)" : ''}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex gap-2 mt-3">
        <Button
          type="button"
          disabled={acting || !successorId}
          onClick={() =>
            handover === 'leave' ? leaveSession(successorId) : transferOwnership(successorId)
          }
          full
        >
          {handover === 'leave' ? 'Transmettre et quitter' : 'Transmettre'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setHandover(null);
            setSuccessorId('');
          }}
          full
        >
          Annuler
        </Button>
      </div>
    </Card>
  );

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
        <div className="mb-4 space-y-3">
          {myStatus ? (
            <>
              {myStatus === 'waitlist' && !notice && (
                <div className="mb-3">
                  <Alert>Vous êtes en liste d'attente.</Alert>
                </div>
              )}
              <Button variant="secondary" onClick={() => act('withdraw')} disabled={acting} full>
                {acting ? '…' : isOrganizer ? 'Libérer ma place' : 'Me désister'}
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

          {/* E-03 : quitter la session, distinct du desistement. L'organisateur
              y abandonne aussi l'organisation, ce qui suppose un successeur. */}
          {isOrganizer && (
            <Button
              variant="secondary"
              onClick={() => leaveSession()}
              disabled={acting || handover === 'leave'}
              full
            >
              Quitter la session
            </Button>
          )}
        </div>
      )}

      {handover === 'leave' && handoverPanel}

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
                  <Link to={`/joueurs/${player.id}`} className="hover:underline">
                    {displayName(player)}
                  </Link>
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

      {!isOrganizer && (
        <div className="mt-6">
          <ReportDialog targetType="event" targetId={eventId!} label="Signaler cette session" />
        </div>
      )}

      {isOrganizer && (
        <Card className="mt-6">
          <h2 className="font-semibold text-gray-900 mb-3">Organisation</h2>

          {editing ? (
            <form onSubmit={saveEvent} className="space-y-3">
              <Field label="Titre" name="editTitle">
                <input
                  id="editTitle" className={inputClass} required
                  value={event.title}
                  onChange={(e) => setEvent((v: any) => ({ ...v, title: e.target.value }))}
                />
              </Field>

              <Field label="Date et heure" name="editDateTime">
                <input
                  id="editDateTime" type="datetime-local" className={inputClass} required
                  value={toLocalInput(event.dateTime)}
                  onChange={(e) => setEvent((v: any) => ({ ...v, dateTime: e.target.value }))}
                />
              </Field>

              <Field label="Lieu" name="editLocation">
                <input
                  id="editLocation" className={inputClass}
                  value={event.location ?? ''}
                  onChange={(e) => setEvent((v: any) => ({ ...v, location: e.target.value }))}
                />
              </Field>

              <Field label="Nombre de places" name="editCapacity">
                <input
                  id="editCapacity" type="number" min={1} max={50} className={inputClass} required
                  value={event.capacity}
                  onChange={(e) => setEvent((v: any) => ({ ...v, capacity: e.target.value }))}
                />
              </Field>

              <div className="flex gap-2">
                <Button type="submit" disabled={acting} full>
                  Enregistrer
                </Button>
                <Button type="button" variant="secondary" onClick={() => setEditing(false)} full>
                  Annuler
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {!closed && (
                <Button type="button" variant="secondary" onClick={() => setEditing(true)} full>
                  Modifier la session
                </Button>
              )}

              {/* E-02 : un brouillon n'est pas encore partageable. */}
              {event.status === 'draft' && (
                <Button type="button" onClick={() => setStatus('open')} disabled={acting} full>
                  Ouvrir aux inscriptions
                </Button>
              )}

              {(event.status === 'open' || event.status === 'full') && (
                <Button
                  type="button" variant="secondary" disabled={acting}
                  onClick={() => setStatus('completed', 'Marquer cette session comme terminée ?')}
                  full
                >
                  Marquer comme terminée
                </Button>
              )}

              {event.groupId && !closed && (
                <Button type="button" variant="secondary" onClick={remind} disabled={acting} full>
                  Relancer les non-répondants
                </Button>
              )}

              {/* E-02 : passer la main sans partir. Sans inscrit, il n'y a
                  personne a qui transmettre : le bouton n'a rien a proposer. */}
              {!closed && successors.length > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setHandover('transfer')}
                  disabled={acting || handover === 'transfer'}
                  full
                >
                  Transmettre l'organisation
                </Button>
              )}

              {handover === 'transfer' && handoverPanel}

              {/* E-04 : recurrence, declenchee par l'organisateur. */}
              <div className="pt-3 border-t border-gray-100">
                <Field
                  label="Dupliquer pour une autre date"
                  name="duplicateDate"
                  hint="La copie est créée en brouillon, sans les inscrits."
                >
                  <input
                    id="duplicateDate" type="datetime-local" className={inputClass}
                    value={duplicateDate}
                    onChange={(e) => setDuplicateDate(e.target.value)}
                  />
                </Field>
                <div className="mt-2">
                  <Button
                    type="button" variant="secondary" onClick={duplicate}
                    disabled={acting || !duplicateDate} full
                  >
                    Dupliquer la session
                  </Button>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 space-y-3">
                {!closed && (
                  <Button type="button" variant="danger" onClick={cancelEvent} disabled={acting} full>
                    Annuler la session
                  </Button>
                )}
                <Button type="button" variant="danger" onClick={removeEvent} disabled={acting} full>
                  Supprimer la session
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default EventDetail;
