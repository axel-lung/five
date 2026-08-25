import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, mediaSrc, useCurrentUser } from 'five-api-client';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Field,
  Input,
  Loading,
  PageTitle,
  Select,
  confirmAsync,
} from 'five-ui';
import Screen from '../../../../components/Screen';
import { LinkButton, LinkCard } from '../../../../components/links';
import ShareButton from '../../../../components/ShareButton';
import ReportDialog from '../../../../components/ReportDialog';
import AvatarUpload from '../../../../components/AvatarUpload';

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
  const [invitations, setInvitations] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [managed, setManaged] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const me = useCurrentUser();
  const router = useRouter();

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

  // Mon role decide de tout l'affichage : il est lu depuis la liste des
  // membres, deja chargee, plutot que par un appel dedie.
  const myRole = members.find((m) => m.userId === me?.id)?.role;
  const isOwner = myRole === 'owner';
  const canAdmin = isOwner || myRole === 'admin';

  const loadInvitations = useCallback(async () => {
    if (!canAdmin) return;
    try {
      const response = await api.get(`/groups/${groupId}/invitations`);
      setInvitations(response.data.filter((i: any) => i.usable));
    } catch {
      setInvitations([]);
    }
  }, [groupId, canAdmin]);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  if (loading) return <Loading />;
  if (error && !group) return <Alert kind="error">{error}</Alert>;

  /** Enveloppe commune : etat occupe, message, rechargement. */
  const run = async (action: () => Promise<void>, success?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      if (success) setNotice(success);
    } catch (err: any) {
      const data = err.response?.data;
      setError(data?.details?.[0] ?? data?.message ?? 'Action impossible');
    } finally {
      setBusy(false);
    }
  };

  const createInvitation = () =>
    run(async () => {
      await api.post(`/groups/${groupId}/invitations`, {});
      await loadInvitations();
    });

  const revokeInvitation = (id: string) =>
    run(async () => {
      if (!(await confirmAsync('Révoquer ce lien ? Il cessera immédiatement de fonctionner.'))) {
        return;
      }
      await api.delete(`/groups/invitations/${id}`);
      await loadInvitations();
    }, 'Lien révoqué.');

  const setRole = (userId: string, role: string) =>
    run(async () => {
      await api.patch(`/groups/${groupId}/members/${userId}/role`, { role });
      await loadMembers();
    }, 'Rôle mis à jour.');

  const transferOwnership = (userId: string, name: string) =>
    run(async () => {
      const ok = await confirmAsync(`Transmettre le groupe à ${name} ? Vous deviendrez admin.`, {
        title: 'Transmettre le groupe',
        confirmLabel: 'Transmettre',
      });
      if (!ok) return;

      await api.post(`/groups/${groupId}/transfer-ownership`, { newOwnerId: userId });
      setManaged(null);
      await Promise.all([loadGroup(), loadMembers()]);
    }, 'Propriété transmise.');

  const removeMember = (userId: string, name: string) =>
    run(async () => {
      const ok = await confirmAsync(`Retirer ${name} du groupe ?`, {
        title: 'Retirer un membre',
        confirmLabel: 'Retirer',
        destructive: true,
      });
      if (!ok) return;

      await api.delete(`/groups/${groupId}/members`, { data: { memberId: userId } });
      setManaged(null);
      await loadMembers();
    }, 'Membre retiré.');

  const leave = () =>
    run(async () => {
      const ok = await confirmAsync('Quitter ce groupe ?', {
        title: 'Quitter le groupe',
        confirmLabel: 'Quitter',
        destructive: true,
      });
      if (!ok) return;

      await api.post(`/groups/${groupId}/leave`);
      router.replace('/groupes');
    });

  const removeGroup = () =>
    run(async () => {
      const ok = await confirmAsync('Supprimer ce groupe et toutes ses données ?', {
        title: 'Supprimer le groupe',
        confirmLabel: 'Supprimer',
        destructive: true,
      });
      if (!ok) return;

      await api.delete(`/groups/${groupId}`);
      router.replace('/groupes');
    });

  const saveGroup = () =>
    run(async () => {
      const payload: Record<string, unknown> = { name: group.name, accessType: group.accessType };
      if (group.city) payload.city = group.city;
      if (group.description) payload.description = group.description;

      await api.put(`/groups/${groupId}`, payload);
      setEditing(false);
      await loadGroup();
    }, 'Groupe mis à jour.');

  const avatar = mediaSrc(group.avatarUrl);

  return (
    <Screen>
      <View className="flex-row items-start gap-4 mb-4">
        {avatar ? <Avatar uri={avatar} size={64} square /> : null}
        <View className="flex-1">
          <PageTitle subtitle={group.city ?? undefined}>{group.name}</PageTitle>
        </View>
      </View>

      {group.description && !editing ? (
        <Text className="text-gray-700 mb-4">{group.description}</Text>
      ) : null}

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

      {myRole ? (
        <View className="gap-3 mb-6">
          <LinkButton href={`/sessions/nouvelle?groupId=${group.id}`}>
            Créer une session pour ce groupe
          </LinkButton>

          {/* S-01 : le chat n'est pas une entite a creer, il existe des la
              creation du groupe — y compris pour les groupes anterieurs. */}
          <LinkButton href={`/groupes/${group.id}/chat`} variant="secondary">
            Ouvrir la discussion
          </LinkButton>
        </View>
      ) : null}

      {/* G-01 : identite du groupe, reservee aux administrateurs. */}
      {canAdmin ? (
        <Card className="mb-6">
          <Text className="font-semibold text-gray-900 mb-3">Identité du groupe</Text>

          <View className="mb-4">
            <AvatarUpload
              endpoint={`/groups/${groupId}/avatar`}
              currentUrl={group.avatarUrl}
              label="Changer le logo"
              square
              onUploaded={(avatarUrl) => {
                setGroup((g: any) => ({ ...g, avatarUrl }));
                setNotice('Logo mis à jour.');
              }}
            />
          </View>

          {editing ? (
            <View className="gap-3">
              <Field label="Nom">
                <Input
                  value={group.name}
                  onChangeText={(name: string) => setGroup((g: any) => ({ ...g, name }))}
                  testID="group-name"
                />
              </Field>

              <Field label="Ville">
                <Input
                  value={group.city ?? ''}
                  onChangeText={(city: string) => setGroup((g: any) => ({ ...g, city }))}
                  testID="group-city"
                />
              </Field>

              <Field label="Description">
                <Input
                  value={group.description ?? ''}
                  onChangeText={(description: string) =>
                    setGroup((g: any) => ({ ...g, description }))
                  }
                  multiline
                  numberOfLines={3}
                  testID="group-description"
                />
              </Field>

              <Field label="Visibilité" hint="Un groupe privé n'est visible que de ses membres.">
                <Select
                  value={group.accessType}
                  options={[
                    { value: 'private', label: 'Privé' },
                    { value: 'public', label: 'Public' },
                  ]}
                  onChange={(accessType) => setGroup((g: any) => ({ ...g, accessType }))}
                  testID="group-access"
                />
              </Field>

              <Button onPress={saveGroup} disabled={busy} testID="group-save" full>
                Enregistrer
              </Button>
              <Button variant="secondary" onPress={() => setEditing(false)} full>
                Annuler
              </Button>
            </View>
          ) : (
            <Button variant="secondary" onPress={() => setEditing(true)} testID="group-edit" full>
              Modifier le groupe
            </Button>
          )}
        </Card>
      ) : null}

      {/* G-02 : liens d'invitation, coeur du parcours « rejoindre un groupe ». */}
      {canAdmin ? (
        <Card className="mb-6">
          <Text className="font-semibold text-gray-900 mb-1">Inviter des joueurs</Text>
          <Text className="text-sm text-gray-600 mb-3">
            Un lien valable 7 jours, à envoyer sur WhatsApp.
          </Text>

          {invitations.length > 0 ? (
            <View className="gap-4">
              {invitations.map((invitation) => (
                <View key={invitation.id} className="gap-2">
                  <ShareButton
                    url={`/invitation/${invitation.token}`}
                    text={`Rejoins ${group.name} sur Five :`}
                  />
                  <Button
                    variant="secondary"
                    onPress={() => revokeInvitation(invitation.id)}
                    disabled={busy}
                    testID="invitation-revoke"
                    full
                  >
                    Révoquer ce lien
                  </Button>
                </View>
              ))}
            </View>
          ) : (
            <Button onPress={createInvitation} disabled={busy} testID="invitation-create" full>
              Générer un lien d'invitation
            </Button>
          )}
        </Card>
      ) : null}

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
                <View key={member.id} className="gap-2">
                  <LinkCard href={`/joueurs/${member.userId}`}>
                    <Text numberOfLines={1} className="text-sm font-medium text-gray-900">
                      {name}
                      {isMe ? <Text className="text-gray-400 font-normal"> — vous</Text> : null}
                    </Text>
                    <Text className="text-xs text-gray-500">
                      {roleLabels[member.role] ?? member.role}
                    </Text>
                  </LinkCard>

                  {/* Le proprietaire seul redistribue les roles : un admin qui
                      pourrait promouvoir d'autres admins rendrait le role de
                      proprietaire decoratif. Les actions sont repliees, sans
                      quoi la liste deviendrait illisible sur telephone. */}
                  {isOwner && !isMe ? (
                    managed === member.userId ? (
                      <Card>
                        <View className="gap-2">
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onPress={() =>
                              setRole(member.userId, member.role === 'member' ? 'admin' : 'member')
                            }
                            full
                          >
                            {member.role === 'member' ? 'Promouvoir admin' : 'Rétrograder membre'}
                          </Button>

                          <Button
                            variant="secondary"
                            disabled={busy}
                            onPress={() => transferOwnership(member.userId, name)}
                            testID="member-transfer"
                            full
                          >
                            Transmettre le groupe
                          </Button>

                          <Button
                            variant="danger"
                            disabled={busy}
                            onPress={() => removeMember(member.userId, name)}
                            testID="member-remove"
                            full
                          >
                            Retirer du groupe
                          </Button>

                          <Button variant="secondary" onPress={() => setManaged(null)} full>
                            Fermer
                          </Button>
                        </View>
                      </Card>
                    ) : (
                      <Button
                        variant="secondary"
                        onPress={() => setManaged(member.userId)}
                        testID={`member-manage-${member.userId}`}
                      >
                        Gérer ce membre
                      </Button>
                    )
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </View>

      {myRole ? (
        <View className="gap-3">
          {/* G-04 : le proprietaire doit transmettre avant de partir. Le lui
              dire ici evite de le laisser buter sur un refus de l'API. */}
          {isOwner ? (
            <Alert>
              Vous êtes propriétaire de ce groupe. Pour le quitter, transmettez-le d'abord à un
              autre membre.
            </Alert>
          ) : (
            <Button variant="secondary" onPress={leave} disabled={busy} testID="group-leave" full>
              Quitter le groupe
            </Button>
          )}

          {isOwner ? (
            <Button variant="danger" onPress={removeGroup} disabled={busy} testID="group-delete" full>
              Supprimer le groupe
            </Button>
          ) : null}
        </View>
      ) : null}

      {!canAdmin ? (
        <View className="mt-4">
          <ReportDialog targetType="group" targetId={group.id} label="Signaler ce groupe" />
        </View>
      ) : null}
    </Screen>
  );
}
