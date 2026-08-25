import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { currentUser } from '../services/api';
import { mediaSrc } from '../components/AvatarUpload';
import ChatImageButton from '../components/ChatImageButton';
import { Alert, Button, Card, inputClass, Loading } from '../components/ui';

/**
 * S-01 : chat instantane d'un groupe.
 *
 * Le WebSocket vit dans Layout et pousse ses trames par des CustomEvent : cet
 * ecran ne gere pas la connexion, seulement ce qui arrive. Et il ne s'y fie
 * jamais pour la completude — a chaque `ready` il redemande le delta par
 * `?since=`, seule facon de rattraper ce qu'une coupure a fait manquer.
 */

const PAGE_SIZE = 30;

const displayName = (user: any) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Compte supprimé';

const relative = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
};

/**
 * Fusionne des messages dans la liste, en dedoublonnant par id.
 *
 * La deduplication est inconditionnelle : un message arrive legitimement
 * jusqu'a trois fois — la trame WebSocket, le delta `?since=`, et la reponse
 * du POST pour ses propres envois.
 */
const merge = (current: any[], incoming: any[]) => {
  const byId = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => byId.set(message.id, message));

  return [...byId.values()].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
      a.id.localeCompare(b.id)
  );
};

const GroupChat: React.FC = () => {
  const { groupId } = useParams();
  const me = currentUser();

  const [group, setGroup] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [cursor, setCursor] = useState<any>(null);
  const [hasMore, setHasMore] = useState(false);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottom = useRef<HTMLDivElement>(null);
  // La liste vit aussi dans une ref : les auditeurs d'evenement sont
  // enregistres une fois et captureraient sinon un etat perime.
  const messagesRef = useRef<any[]>([]);
  messagesRef.current = messages;

  const scrollToBottom = () =>
    requestAnimationFrame(() => bottom.current?.scrollIntoView({ block: 'end' }));

  const markRead = useCallback(() => {
    api
      .post(`/groups/${groupId}/messages/read`, {})
      .then(() => window.dispatchEvent(new CustomEvent('chat:unread')))
      .catch(() => undefined);
  }, [groupId]);

  // Chargement initial : la page la plus recente.
  useEffect(() => {
    let cancelled = false;

    Promise.all([
      api.get(`/groups/${groupId}`),
      api.get(`/groups/${groupId}/messages`, { params: { limit: PAGE_SIZE } }),
    ])
      .then(([groupRes, messagesRes]) => {
        if (cancelled) return;
        setGroup(groupRes.data);
        // L'API rend du plus recent au plus ancien ; on affiche l'inverse.
        setMessages([...messagesRes.data.messages].reverse());
        setHasMore(messagesRes.data.hasMore);
        setCursor(messagesRes.data.nextCursor);
        scrollToBottom();
        markRead();
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err.response?.status === 403
            ? 'Rejoignez le groupe pour voir la discussion.'
            : (err.response?.data?.message ?? 'Discussion introuvable')
        );
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [groupId, markRead]);

  // Trames poussees par la socket, et rattrapage a chaque reconnexion.
  useEffect(() => {
    const onMessage = (event: any) => {
      if (event.detail?.groupId !== groupId) return;
      setMessages((current) => merge(current, [event.detail.message]));
      scrollToBottom();
      markRead();
    };

    const onDeleted = (event: any) => {
      if (event.detail?.groupId !== groupId) return;
      setMessages((current) => merge(current, [event.detail.message]));
    };

    const onReady = () => {
      // Le curseur est un createdAt emis par le serveur, jamais Date.now() :
      // l'horloge du navigateur derive, et un curseur en avance creerait un
      // trou definitif dans la conversation.
      const newest = messagesRef.current[messagesRef.current.length - 1];
      if (!newest) return;

      api
        .get(`/groups/${groupId}/messages`, { params: { since: newest.createdAt } })
        .then((res) => {
          if (res.data.truncated) {
            // Trop de retard pour recoudre : on recharge la page recente.
            return api
              .get(`/groups/${groupId}/messages`, { params: { limit: PAGE_SIZE } })
              .then((fresh) => {
                setMessages([...fresh.data.messages].reverse());
                setHasMore(fresh.data.hasMore);
                setCursor(fresh.data.nextCursor);
              });
          }
          setMessages((current) => merge(current, res.data.messages));
        })
        .catch(() => undefined);
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') markRead();
    };

    window.addEventListener('chat:message', onMessage);
    window.addEventListener('chat:deleted', onDeleted);
    window.addEventListener('chat:ready', onReady);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.removeEventListener('chat:message', onMessage);
      window.removeEventListener('chat:deleted', onDeleted);
      window.removeEventListener('chat:ready', onReady);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [groupId, markRead]);

  const loadOlder = async () => {
    if (!cursor) return;
    setBusy(true);

    try {
      const res = await api.get(`/groups/${groupId}/messages`, {
        params: { limit: PAGE_SIZE, before: cursor.before, beforeId: cursor.beforeId },
      });
      setMessages((current) => merge(current, res.data.messages));
      setHasMore(res.data.hasMore);
      setCursor(res.data.nextCursor);
    } catch {
      setError('Chargement des messages précédents impossible');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Envoi optimiste.
   *
   * Le nonce est genere ici et rejoue tel quel en cas d'echec : si le premier
   * envoi avait en realite abouti, le serveur renvoie le message existant au
   * lieu d'en creer un second.
   */
  const submit = async (event: React.FormEvent, retry?: any) => {
    event.preventDefault();

    const body = retry ? retry.body : draft.trim();
    if (!body) return;

    const clientNonce = retry?.clientNonce ?? crypto.randomUUID();

    setPending((current) =>
      retry
        ? current.map((p) => (p.clientNonce === clientNonce ? { ...p, status: 'sending' } : p))
        : [...current, { clientNonce, body, status: 'sending' }]
    );
    if (!retry) setDraft('');
    scrollToBottom();

    try {
      const res = await api.post(`/groups/${groupId}/messages`, { body, clientNonce });
      setPending((current) => current.filter((p) => p.clientNonce !== clientNonce));
      setMessages((current) => merge(current, [res.data]));
      scrollToBottom();
    } catch (err: any) {
      setPending((current) =>
        current.map((p) => (p.clientNonce === clientNonce ? { ...p, status: 'failed' } : p))
      );
      if (err.response?.status === 429) {
        setError('Trop de messages, patientez un instant.');
      }
    }
  };

  const remove = async (message: any) => {
    if (!window.confirm('Supprimer ce message ?')) return;

    try {
      const res = await api.delete(`/groups/${groupId}/messages/${message.id}`);
      setMessages((current) => merge(current, [res.data]));
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Suppression impossible');
    }
  };

  if (loading) return <Loading />;
  if (error && !group) return <Alert kind="error">{error}</Alert>;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 14rem)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">{group?.name}</h1>
          <Link to={`/groupes/${groupId}`} className="text-sm text-gray-600 underline">
            Retour au groupe
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-3">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      {/* Le fil defile, le composeur reste. */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-white p-3">
        {hasMore && (
          <div className="mb-3 flex justify-center">
            <Button type="button" variant="secondary" onClick={loadOlder} disabled={busy}>
              {busy ? 'Chargement…' : 'Voir les messages précédents'}
            </Button>
          </div>
        )}

        {messages.length === 0 && pending.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-600">
              Aucun message pour l'instant. Lancez la discussion !
            </p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {messages.map((message) => {
              const isMine = message.authorId === me?.id;
              const image = mediaSrc(message.imageUrl);

              return (
                <li key={message.id} className={isMine ? 'text-right' : ''}>
                  <div
                    className={`inline-block max-w-[85%] text-left rounded-xl px-3 py-2 ${
                      isMine ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
                    }`}
                  >
                    <p className="text-xs text-gray-500">
                      {displayName(message.author)} · {relative(message.createdAt)}
                    </p>

                    {message.deletedAt ? (
                      <p className="text-sm italic text-gray-400">Message supprimé</p>
                    ) : (
                      <>
                        {image && (
                          <img
                            src={image}
                            alt=""
                            className="mt-1 max-w-full rounded-lg border border-gray-200"
                          />
                        )}
                        {message.body && (
                          // break-words : un mot sans espace ferait deborder la
                          // page horizontalement sur telephone.
                          <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                            {message.body}
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {!message.deletedAt && isMine && (
                    <div>
                      <button
                        type="button"
                        onClick={() => remove(message)}
                        className="text-xs text-red-700 underline min-h-[44px] px-2"
                      >
                        Supprimer
                      </button>
                    </div>
                  )}
                </li>
              );
            })}

            {pending.map((item) => (
              <li key={item.clientNonce} className="text-right">
                <div className="inline-block max-w-[85%] text-left rounded-xl px-3 py-2 bg-gray-100 border border-gray-200 opacity-70">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                    {item.body}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.status === 'failed' ? 'Non envoyé' : 'Envoi…'}
                  </p>
                </div>

                {item.status === 'failed' && (
                  <div>
                    <button
                      type="button"
                      onClick={(e) => submit(e, item)}
                      className="text-xs text-green-700 underline min-h-[44px] px-2"
                    >
                      Réessayer
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <div ref={bottom} />
      </div>

      <form onSubmit={submit} className="mt-3 flex items-end gap-2">
        <textarea
          id="chatMessage"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Votre message"
          aria-label="Votre message"
          rows={1}
          maxLength={2000}
          className={`${inputClass} max-h-[120px] resize-none`}
        />

        <ChatImageButton
          groupId={groupId!}
          onSent={(message) => {
            setMessages((current) => merge(current, [message]));
            scrollToBottom();
          }}
          onError={setError}
        />

        <Button type="submit" disabled={draft.trim().length === 0}>
          Envoyer
        </Button>
      </form>
    </div>
  );
};

export default GroupChat;
