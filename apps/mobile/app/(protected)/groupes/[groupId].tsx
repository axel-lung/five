import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api, mediaSrc, useCurrentUser } from 'five-api-client';
import { Alert, Avatar, Card, Input, Loading, PageTitle } from 'five-ui';
import Screen from '../../../components/Screen';
import { LinkButton, LinkCard } from '../../../components/links';

const roleLabels: Record<string, string> = {
  owner: 'Propriétaire',
  admin: 'Admin',
  member: 'Membre',
};

const displayName = (user: any) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Compte supprimé';

export default function GroupDetail() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const me = useCurrentUser();

  const loadGroup = useCallback(async () => {
    try {
      const response = await api.get(`/groups/${groupId}`);
      setGroup(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Groupe introuvable');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const loadMembers = useCallback(async () => {
    try {
      const response = await api.get(`/groups/${groupId}/members`, {
        params: query ? { q: query } : undefined,
      });
      setMembers(response.data);
    } catch {
      setMembers([]);
    }
  }, [groupId, query]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  useEffect(() => {
    // Petit delai : sans lui, chaque frappe declenche une requete.
    const timer = setTimeout(loadMembers, 250);
    return () => clearTimeout(timer);
  }, [loadMembers]);

  if (loading) return <Loading />;
  if (error && !group) return <Alert kind="error">{error}</Alert>;

  // Mon role decide de tout l'affichage : il est lu depuis la liste des
  // membres, deja chargee, plutot que par un appel dedie.
  const myRole = members.find((m) => m.userId === me?.id)?.role;
  const isOwner = myRole === 'owner';
  const avatar = mediaSrc(group.avatarUrl);

  return (
    <Screen>
      <View className="flex-row items-start gap-4 mb-4">
        {avatar ? <Avatar uri={avatar} size={64} square /> : null}
        <View className="flex-1">
          <PageTitle subtitle={group.city ?? undefined}>{group.name}</PageTitle>
        </View>
      </View>

      {group.description ? (
        <Text className="text-gray-700 mb-4">{group.description}</Text>
      ) : null}

      {error ? (
        <View className="mb-4">
          <Alert kind="error">{error}</Alert>
        </View>
      ) : null}

      {myRole ? (
        <LinkButton href={`/sessions/nouvelle?groupId=${group.id}`} className="mb-6">
          Créer une session pour ce groupe
        </LinkButton>
      ) : null}

      {/* TODO Phase 2 : identite du groupe (G-01), liens d'invitation (G-02),
          gestion des roles, quitter/supprimer, signalement. Toutes ces actions
          passent par confirmAsync ou par un televersement. */}

      <View className="mb-6">
        <Text className="text-lg font-bold text-gray-900 mb-3">Membres ({members.length})</Text>

        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher un joueur"
          accessibilityLabel="Rechercher un membre"
          autoCapitalize="none"
          className="mb-3"
        />

        {members.length === 0 ? (
          <Card>
            <Text className="text-sm text-gray-600">
              {query ? 'Aucun joueur ne correspond.' : 'Aucun membre.'}
            </Text>
          </Card>
        ) : (
          <View className="gap-2">
            {members.map((member) => {
              const name = displayName(member.user);
              const isMe = member.userId === me?.id;

              return (
                <LinkCard key={member.id} href={`/joueurs/${member.userId}`}>
                  <Text numberOfLines={1} className="text-sm font-medium text-gray-900">
                    {name}
                    {isMe ? <Text className="text-gray-400 font-normal"> — vous</Text> : null}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    {roleLabels[member.role] ?? member.role}
                  </Text>
                </LinkCard>
              );
            })}
          </View>
        )}
      </View>

      {/* G-04 : le proprietaire doit transmettre avant de partir. Le lui dire
          ici evite de le laisser buter sur un refus de l'API. */}
      {isOwner ? (
        <Alert>
          Vous êtes propriétaire de ce groupe. Pour le quitter, transmettez-le d'abord à un autre
          membre.
        </Alert>
      ) : null}
    </Screen>
  );
}
