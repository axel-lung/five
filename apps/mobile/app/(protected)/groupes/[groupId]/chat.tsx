import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api, mediaSrc, useCurrentUser } from 'five-api-client';
import { Alert, Button, Card, confirmAsync, eventBus, inputClass, Loading } from 'five-ui';
import { LinkButton } from '../../../../components/links';

/**
 * S-01 : chat instantane d'un groupe.
 *
 * Le WebSocket vit dans la coque (`(protected)/_layout.tsx`) et pousse ses
 * trames par l'eventBus : cet ecran ne gere pas la connexion, seulement ce qui
 * arrive. Et il ne s'y fie jamais pour la completude — a chaque `ready` il
 * redemande le delta par `?since=`, seule facon de rattraper ce qu'une
 * coupure reseau a fait manquer.
 *
 * ATTENTION : cet ecran n'utilise volontairement PAS `components/Screen`.
 * Screen est lui-meme un ScrollView en `grow`, ce qui ferait defiler le
 * composeur avec la liste. Ici la vue est fixe, seul le fil defile. C'est un
 * ecart assume a la convention maison.
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
 * Fusionne des messages, en dedoublonnant par id.
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

export default function GroupChat() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const me = useCurrentUser();

  const [group, setGroup] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [cursor, setCursor] = useState<any>(null);
  const [hasMore, setHasMore] = useState(false);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = useRef<ScrollView>(null);
  // La liste vit aussi dans une ref : les abonnements au bus sont poses une
  // fois et captureraient sinon un etat perime.
  const messagesRef = useRef<any[]>([]);
  messagesRef.current = messages;

  const scrollToBottom = () =>
    requestAnimationFrame(() => list.current?.scrollToEnd({ animated: false }));

  const markRead = useCallback(() => {
    api
      .post(`/groups/${groupId}/messages/read`, {})
      .then(() => eventBus.emit('chat:unread'))
      .catch(() => undefined);
  }, [groupId]);

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
      })
      .catch((err: any) => {
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
  }, [groupId]);

  // Trames poussees par la socket, et rattrapage a chaque reconnexion.
  useEffect(() => {
    const onMessage = ({ groupId: id, message }: any) => {
      if (id !== groupId) return;
      setMessages((current) => merge(current, [message]));
      scrollToBottom();
      markRead();
    };

    const onDeleted = ({ groupId: id, message }: any) => {
      if (id !== groupId) return;
      setMessages((current) => merge(current, [message]));
    };

    const onReady = () => {
      // Le curseur est un createdAt emis par le serveur, jamais Date.now() :
      // l'horloge du telephone derive, et un curseur en avance creerait un
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

    eventBus.on('chat:message', onMessage);
    eventBus.on('chat:deleted', onDeleted);
    eventBus.on('chat:ready', onReady);

    return () => {
      eventBus.off('chat:message', onMessage);
      eventBus.off('chat:deleted', onDeleted);
      eventBus.off('chat:ready', onReady);
    };
  }, [groupId, markRead]);

  // Marquer comme lu au retour sur l'ecran, pas seulement au montage : les
  // onglets gardent leur etat, un ecran revisite ne se remonte pas.
  useFocusEffect(
    useCallback(() => {
      markRead();
    }, [markRead])
  );

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
   * lieu d'en creer un second. Sur mobile, ce cas se produit chaque fois qu'on
   * traverse un tunnel.
   */
  const submit = async (retry?: any) => {
    const body = retry ? retry.body : draft.trim();
    if (!body) return;

    const clientNonce = retry?.clientNonce ?? nonce();

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

  const attachImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setBusy(true);

    try {
      const form = new FormData();

      if (Platform.OS === 'web') {
        // Sur le web, FormData exige un vrai Blob : l'objet {uri,name,type} de
        // React Native y serait serialise en "[object Object]".
        const blob = await (await fetch(asset.uri)).blob();
        form.append('image', blob, 'photo.jpg');
      } else {
        form.append('image', {
          uri: asset.uri,
          name: 'photo.jpg',
          type: asset.mimeType ?? 'image/jpeg',
        } as any);
      }

      // Content-Type volontairement absent : axios doit poser lui-meme la
      // frontiere multipart, qu'on ne peut pas ecrire a la main.
      const res = await api.post(`/groups/${groupId}/messages/image`, form);
      setMessages((current) => merge(current, [res.data]));
      scrollToBottom();
    } catch (err: any) {
      // Les messages de l'API sont en anglais, l'interface en francais : on
      // traduit ici, comme le fait l'ecran des notifications pour ses types.
      // `quality` ne garantit pas la taille : une photo 12 Mpx depasse encore
      // les 2 Mo du serveur, et c'est ce 400-la qu'on rattrape.
      setError(
        err.response?.status === 400
          ? 'Image refusée : formats acceptés jpeg, png, webp, 2 Mo maximum.'
          : "Envoi de l'image impossible."
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (message: any) => {
    const confirmed = await confirmAsync('Supprimer ce message ?', {
      title: 'Supprimer',
      confirmLabel: 'Supprimer',
      destructive: true,
    });
    if (!confirmed) return;

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
    <KeyboardAvoidingView
      // Android redimensionne deja la fenetre (adjustResize) : `padding` y
      // compterait le clavier deux fois et laisserait un vide sous le
      // composeur.
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
      className="flex-1"
    >
      <View className="flex-row items-center justify-between mb-3">
        <Text numberOfLines={1} className="text-xl font-bold text-gray-900 flex-1">
          {group?.name}
        </Text>
        <LinkButton href={`/groupes/${groupId}`} variant="secondary" className="ml-2">
          Groupe
        </LinkButton>
      </View>

      {error ? (
        <View className="mb-3">
          <Alert kind="error">{error}</Alert>
        </View>
      ) : null}

      <ScrollView
        ref={list}
        className="flex-1 rounded-xl border border-gray-200 bg-white"
        contentContainerClassName="p-3 gap-3"
        keyboardShouldPersistTaps="handled"
      >
        {hasMore ? (
          <Button variant="secondary" onPress={loadOlder} disabled={busy}>
            {busy ? 'Chargement…' : 'Voir les messages précédents'}
          </Button>
        ) : null}

        {messages.length === 0 && pending.length === 0 ? (
          <Card>
            <Text className="text-sm text-gray-600">
              Aucun message pour l'instant. Lancez la discussion !
            </Text>
          </Card>
        ) : null}

        {messages.map((message) => {
          const isMine = message.authorId === me?.id;
          const image = mediaSrc(message.imageUrl);

          return (
            <View key={message.id} className={isMine ? 'items-end' : 'items-start'}>
              <View
                className={`max-w-[85%] rounded-xl px-3 py-2 border ${
                  isMine ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <Text className="text-xs text-gray-500">
                  {displayName(message.author)} · {relative(message.createdAt)}
                </Text>

                {message.deletedAt ? (
                  <Text className="text-sm italic text-gray-400">Message supprimé</Text>
                ) : (
                  <>
                    {image ? (
                      <Image
                        source={{ uri: image }}
                        accessibilityIgnoresInvertColors
                        style={{ width: 200, height: 200 }}
                        resizeMode="cover"
                        className="mt-1 rounded-lg border border-gray-200"
                      />
                    ) : null}
                    {message.body ? (
                      <Text className="text-sm text-gray-900">{message.body}</Text>
                    ) : null}
                  </>
                )}
              </View>

              {!message.deletedAt && isMine ? (
                <Pressable onPress={() => remove(message)} className="min-h-[44px] px-2 justify-center">
                  <Text className="text-xs text-red-700 underline">Supprimer</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}

        {pending.map((item) => (
          <View key={item.clientNonce} className="items-end">
            <View className="max-w-[85%] rounded-xl px-3 py-2 border bg-gray-100 border-gray-200 opacity-70">
              <Text className="text-sm text-gray-700">{item.body}</Text>
              <Text className="text-xs text-gray-500">
                {item.status === 'failed' ? 'Non envoyé' : 'Envoi…'}
              </Text>
            </View>

            {item.status === 'failed' ? (
              <Pressable onPress={() => submit(item)} className="min-h-[44px] px-2 justify-center">
                <Text className="text-xs text-green-700 underline">Réessayer</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </ScrollView>

      <View className="flex-row items-end gap-2 mt-3">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Votre message"
          placeholderTextColor="#9ca3af"
          accessibilityLabel="Votre message"
          multiline
          maxLength={2000}
          className={`${inputClass} flex-1 max-h-[120px]`}
        />

        <Pressable
          onPress={attachImage}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Joindre une image"
          className="min-h-[44px] min-w-[44px] rounded-lg border border-gray-300 bg-white items-center justify-center"
        >
          <Text className="text-lg">📷</Text>
        </Pressable>

        <Button onPress={() => submit()} disabled={draft.trim().length === 0}>
          Envoyer
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * Identifiant d'envoi.
 *
 * `crypto.randomUUID` n'existe pas sur Hermes : on compose un UUID v4 a la
 * main, le serveur validant le format.
 */
const nonce = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
