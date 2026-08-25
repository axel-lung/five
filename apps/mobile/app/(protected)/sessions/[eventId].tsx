import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { api, useCurrentUser } from 'five-api-client';
import {
  Alert,
  Button,
  Card,
  confirmAsync,
  Field,
  formatDateTime,
  Loading,
  PageTitle,
  Select,
  StatusBadge,
} from 'five-ui';
import ShareButton from '../../../components/ShareButton';
import Screen from '../../../components/Screen';

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

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <View className="flex-row gap-2">
    <Text className="text-sm text-gray-500 w-20">{label}</Text>
    <Text className="flex-1 text-sm font-medium text-gray-900">{children}</Text>
  </View>
);

export default function EventDetail() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Choix du successeur : ouvert soit pour un depart (« leave »), soit pour une
  // transmission seule (« transfer »). Le meme panneau sert aux deux.
  const [handover, setHandover] = useState<'leave' | 'transfer' | null>(null);
  const [successorId, setSuccessorId] = useState('');
  const me = useCurrentUser();

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
        const accepted = await confirmAsync(
          'Vous êtes seul dans cette session. La quitter revient à la supprimer.',
          { title: 'Supprimer la session', confirmLabel: 'Supprimer', destructive: true }
        );

        if (accepted) {
          await api.delete(`/events/${eventId}`);
          router.replace('/dashboard');
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
        setNotice("Une relance a déjà été envoyée aujourd'hui pour cette session.");
      } else {
        setError(err.response?.data?.message ?? 'Relance impossible');
      }
    } finally {
      setActing(false);
    }
  };

  /** E-02 : un brouillon n'est pas encore partageable. */
  const open = async () => {
    setActing(true);
    setError(null);
    setNotice(null);
    try {
      await api.patch(`/events/${eventId}/status`, { status: 'open' });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Changement de statut impossible');
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
      <Text className="font-semibold text-gray-900 mb-1">
        {handover === 'leave' ? 'À qui laissez-vous la session ?' : "Transmettre l'organisation"}
      </Text>
      <Text className="text-sm text-gray-600 mb-3">
        {handover === 'leave'
          ? 'Vous organisez cette session : désignez qui la reprend avant de partir.'
          : "Vous gardez votre place de joueur ; c'est l'organisation qui change de mains."}
      </Text>

      <Field label="Nouvel organisateur">
        <Select
          testID="successor-select"
          value={successorId}
          onChange={setSuccessorId}
          placeholder="Choisir un joueur…"
          options={successors.map((player) => ({
            value: player.id,
            label:
              displayName(player) +
              (player.EventInscription?.status === 'waitlist' ? " (liste d'attente)" : ''),
          }))}
        />
      </Field>

      <View className="flex-row gap-2 mt-3">
        <View className="flex-1">
          <Button
            testID="handover-confirm"
            disabled={acting || !successorId}
            onPress={() =>
              handover === 'leave' ? leaveSession(successorId) : transferOwnership(successorId)
            }
            full
          >
            {handover === 'leave' ? 'Transmettre et quitter' : 'Transmettre'}
          </Button>
        </View>
        <View className="flex-1">
          <Button
            variant="secondary"
            onPress={() => {
              setHandover(null);
              setSuccessorId('');
            }}
            full
          >
            Annuler
          </Button>
        </View>
      </View>
    </Card>
  );

  return (
    <Screen>
      <View className="flex-row items-start justify-between gap-3 mb-1">
        <View className="flex-1">
          <PageTitle>{event.title}</PageTitle>
        </View>
        <StatusBadge status={event.status} />
      </View>

      {notice ? (
        <View className="mb-4">
          <Alert kind="success">{notice}</Alert>
        </View>
      ) : null}
      {error ? (
        <View className="mb-4">
          <Alert kind="error">{error}</Alert>
        </View>
      ) : null}

      <Card className="mb-4">
        <View className="gap-2">
          <Row label="Quand">{formatDateTime(event.dateTime)}</Row>

          {event.venue || event.location ? (
            <Row label="Où">{event.venue?.name ?? event.location}</Row>
          ) : null}

          <Row label="Places">
            {confirmed.length} / {event.capacity}
            {spotsLeft > 0 && event.status === 'open' ? (
              <Text className="text-gray-500 font-normal">
                {' '}
                — {spotsLeft} restante{spotsLeft > 1 ? 's' : ''}
              </Text>
            ) : null}
          </Row>

          {event.price != null ? <Row label="Prix">{event.price} €</Row> : null}

          {event.organizer ? (
            <Row label="Organisé">par {event.organizer.firstName}</Row>
          ) : null}
        </View>

        {event.description ? (
          <Text className="text-sm text-gray-700 mt-4 pt-4 border-t border-gray-100">
            {event.description}
          </Text>
        ) : null}
      </Card>

      {!closed ? (
        <View className="mb-4 gap-3">
          {myStatus ? (
            <>
              {myStatus === 'waitlist' && !notice ? (
                <View className="mb-3">
                  <Alert>Vous êtes en liste d'attente.</Alert>
                </View>
              ) : null}
              <Button
                testID="event-leave"
                variant="secondary"
                onPress={() => act('withdraw')}
                disabled={acting}
                full
              >
                {acting ? '…' : isOrganizer ? 'Libérer ma place' : 'Me désister'}
              </Button>
            </>
          ) : (
            <Button testID="event-join" onPress={() => act('join')} disabled={acting} full>
              {acting ? '…' : spotsLeft > 0 ? 'Je participe' : "Rejoindre la liste d'attente"}
            </Button>
          )}

          {/* E-03 : quitter la session, distinct du desistement. L'organisateur
              y abandonne aussi l'organisation, ce qui suppose un successeur. */}
          {isOrganizer ? (
            <Button
              testID="event-quit"
              variant="secondary"
              onPress={() => leaveSession()}
              disabled={acting || handover === 'leave'}
              full
            >
              Quitter la session
            </Button>
          ) : null}
        </View>
      ) : null}

      {handover === 'leave' ? handoverPanel : null}

      {/* S-03 : le lien partageable se consulte sans compte (E-07). */}
      {event.shareableLinkToken && (
        <View className="mb-4">
          <ShareButton
            url={`/e/${event.shareableLinkToken}`}
            text={`${event.title} — ${formatDateTime(event.dateTime)}`}
          />
        </View>
      )}

      <View className="mb-4">
        <Text className="text-lg font-bold text-gray-900 mb-3">
          Confirmés ({confirmed.length})
        </Text>

        {confirmed.length === 0 ? (
          <Card>
            <Text className="text-gray-600 text-sm">Personne pour l'instant.</Text>
          </Card>
        ) : (
          <Card>
            {confirmed.map((player, index) => (
              <View
                key={player.id}
                className={`py-2 ${index > 0 ? 'border-t border-gray-100' : ''}`}
              >
                <Text className="text-sm text-gray-800">
                  <Link href={`/joueurs/${player.id}` as never} className="underline">
                    {displayName(player)}
                  </Link>
                  {player.id === me?.id ? (
                    <Text className="text-gray-400"> — vous</Text>
                  ) : null}
                </Text>
              </View>
            ))}
          </Card>
        )}
      </View>

      {waitlist.length > 0 ? (
        <View className="mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">
            Liste d'attente ({waitlist.length})
          </Text>
          <Card>
            {waitlist.map((player, index) => (
              <View
                key={player.id}
                className={`py-2 ${index > 0 ? 'border-t border-gray-100' : ''}`}
              >
                <Text className="text-sm text-gray-800">
                  <Text className="text-gray-400">{index + 1}. </Text>
                  {displayName(player)}
                  {player.id === me?.id ? (
                    <Text className="text-gray-400"> — vous</Text>
                  ) : null}
                </Text>
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {/* TODO Phase 2 : signalement de la session (ReportDialog). */}

      {isOrganizer ? (
        <Card className="mt-6">
          <Text className="font-semibold text-gray-900 mb-3">Organisation</Text>

          <View className="gap-3">
            {event.status === 'draft' ? (
              <Button onPress={open} disabled={acting} full>
                Ouvrir aux inscriptions
              </Button>
            ) : null}

            {event.groupId && !closed ? (
              <Button variant="secondary" onPress={remind} disabled={acting} full>
                Relancer les non-répondants
              </Button>
            ) : null}

            {/* E-02 : passer la main sans partir. Sans inscrit, il n'y a
                personne a qui transmettre : le bouton n'a rien a proposer. */}
            {!closed && successors.length > 0 ? (
              <Button
                testID="event-transfer"
                variant="secondary"
                onPress={() => setHandover('transfer')}
                disabled={acting || handover === 'transfer'}
                full
              >
                Transmettre l'organisation
              </Button>
            ) : null}

            {handover === 'transfer' ? handoverPanel : null}
          </View>

          {/* TODO Phase 2 : modification (E-01), duplication (E-04), passage en
              terminee, annulation et suppression — toutes protegees par une
              demande de confirmation. */}
        </Card>
      ) : null}
    </Screen>
  );
}
