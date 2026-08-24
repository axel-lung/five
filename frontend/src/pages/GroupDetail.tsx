import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { currentUser } from '../services/api';
import ShareButton from '../components/ShareButton';
import AvatarUpload, { mediaSrc } from '../components/AvatarUpload';
import ReportDialog from '../components/ReportDialog';
import {
  Alert,
  Button,
  Card,
  Field,
  inputClass,
  Loading,
  PageTitle,
} from '../components/ui';

const roleLabels: Record<string, string> = {
  owner: 'Propriétaire',
  admin: 'Admin',
  member: 'Membre',
};

const displayName = (user: any) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Compte supprimé';

const GroupDetail: React.FC = () => {
  const { groupId } = useParams();
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const me = currentUser();
  const navigate = useNavigate();

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
      setError(err.response?.data?.message ?? 'Action impossible');
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
      if (!window.confirm(`Transmettre le groupe à ${name} ? Vous deviendrez admin.`)) return;
      await api.post(`/groups/${groupId}/transfer-ownership`, { newOwnerId: userId });
      await Promise.all([loadGroup(), loadMembers()]);
    }, 'Propriété transmise.');

  const removeMember = (userId: string, name: string) =>
    run(async () => {
      if (!window.confirm(`Retirer ${name} du groupe ?`)) return;
      await api.delete(`/groups/${groupId}/members`, { data: { memberId: userId } });
      await loadMembers();
    }, 'Membre retiré.');

  const leave = () =>
    run(async () => {
      if (!window.confirm('Quitter ce groupe ?')) return;
      await api.post(`/groups/${groupId}/leave`);
      navigate('/groupes', { replace: true });
    });

  const removeGroup = () =>
    run(async () => {
      if (!window.confirm('Supprimer ce groupe et toutes ses données ?')) return;
      await api.delete(`/groups/${groupId}`);
      navigate('/groupes', { replace: true });
    });

  const saveGroup = (e: React.FormEvent) => {
    e.preventDefault();
    return run(async () => {
      const payload: Record<string, unknown> = { name: group.name, accessType: group.accessType };
      if (group.city) payload.city = group.city;
      if (group.description) payload.description = group.description;

      await api.put(`/groups/${groupId}`, payload);
      setEditing(false);
      await loadGroup();
    }, 'Groupe mis à jour.');
  };

  const avatar = mediaSrc(group.avatarUrl);

  return (
    <div>
      <div className="flex items-start gap-4 mb-4">
        {avatar && (
          <img
            src={avatar}
            alt=""
            className="w-16 h-16 rounded-xl object-cover border border-gray-200 shrink-0"
          />
        )}
        <div className="min-w-0">
          <PageTitle subtitle={group.city ?? undefined}>{group.name}</PageTitle>
        </div>
      </div>

      {group.description && !editing && <p className="text-gray-700 mb-4">{group.description}</p>}

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

      {myRole && (
        <Link
          to={`/sessions/nouvelle?groupId=${group.id}`}
          className="min-h-[44px] flex items-center justify-center rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition mb-6"
        >
          Créer une session pour ce groupe
        </Link>
      )}

      {/* G-01 : identite du groupe, reservee aux administrateurs. */}
      {canAdmin && (
        <Card className="mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">Identité du groupe</h2>

          <div className="mb-4">
            <AvatarUpload
              endpoint={`/groups/${groupId}/avatar`}
              currentUrl={group.avatarUrl}
              label="Changer le logo"
              onUploaded={(avatarUrl) => {
                setGroup((g: any) => ({ ...g, avatarUrl }));
                setNotice('Logo mis à jour.');
              }}
            />
          </div>

          {editing ? (
            <form onSubmit={saveGroup} className="space-y-3">
              <Field label="Nom" name="groupName">
                <input
                  id="groupName" className={inputClass} required
                  value={group.name}
                  onChange={(e) => setGroup((g: any) => ({ ...g, name: e.target.value }))}
                />
              </Field>

              <Field label="Ville" name="groupCity">
                <input
                  id="groupCity" className={inputClass}
                  value={group.city ?? ''}
                  onChange={(e) => setGroup((g: any) => ({ ...g, city: e.target.value }))}
                />
              </Field>

              <Field label="Description" name="groupDescription">
                <textarea
                  id="groupDescription" rows={3} className={inputClass}
                  value={group.description ?? ''}
                  onChange={(e) => setGroup((g: any) => ({ ...g, description: e.target.value }))}
                />
              </Field>

              <Field label="Visibilité" name="groupAccess" hint="Un groupe privé n'est visible que de ses membres.">
                <select
                  id="groupAccess" className={inputClass}
                  value={group.accessType}
                  onChange={(e) => setGroup((g: any) => ({ ...g, accessType: e.target.value }))}
                >
                  <option value="private">Privé</option>
                  <option value="public">Public</option>
                </select>
              </Field>

              <div className="flex gap-2">
                <Button type="submit" disabled={busy} full>
                  Enregistrer
                </Button>
                <Button type="button" variant="secondary" onClick={() => setEditing(false)} full>
                  Annuler
                </Button>
              </div>
            </form>
          ) : (
            <Button type="button" variant="secondary" onClick={() => setEditing(true)} full>
              Modifier le groupe
            </Button>
          )}
        </Card>
      )}

      {/* G-02 : liens d'invitation, coeur du parcours « rejoindre un groupe ». */}
      {canAdmin && (
        <Card className="mb-6">
          <h2 className="font-semibold text-gray-900 mb-1">Inviter des joueurs</h2>
          <p className="text-sm text-gray-600 mb-3">
            Un lien valable 7 jours, à envoyer sur WhatsApp.
          </p>

          {invitations.length > 0 ? (
            <div className="space-y-4">
              {invitations.map((invitation) => (
                <div key={invitation.id} className="space-y-2">
                  <ShareButton
                    url={`/invitation/${invitation.token}`}
                    text={`Rejoins ${group.name} sur Five :`}
                  />
                  <button
                    type="button"
                    onClick={() => revokeInvitation(invitation.id)}
                    className="text-sm text-red-700 underline min-h-[44px]"
                  >
                    Révoquer ce lien
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <Button type="button" onClick={createInvitation} disabled={busy} full>
              Générer un lien d'invitation
            </Button>
          )}
        </Card>
      )}

      <section className="mb-6">
        <h2 className="text-lg font-bold mb-3">Membres ({members.length})</h2>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un joueur"
          className={`${inputClass} mb-3`}
          aria-label="Rechercher un membre"
        />

        {members.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-600">
              {query ? 'Aucun joueur ne correspond.' : 'Aucun membre.'}
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {members.map((member) => {
              const name = displayName(member.user);
              const isMe = member.userId === me?.id;

              return (
                <Card key={member.id}>
                  <div className="flex items-center justify-between gap-3">
                    <Link to={`/joueurs/${member.userId}`} className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {name}
                        {isMe && <span className="text-gray-400 font-normal"> — vous</span>}
                      </p>
                      <p className="text-xs text-gray-500">{roleLabels[member.role] ?? member.role}</p>
                    </Link>
                  </div>

                  {/* Le proprietaire seul redistribue les roles : un admin qui
                      pourrait promouvoir d'autres admins rendrait le role de
                      proprietaire decoratif. */}
                  {isOwner && !isMe && (
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                      {member.role === 'member' ? (
                        <button
                          type="button" disabled={busy}
                          onClick={() => setRole(member.userId, 'admin')}
                          className="text-sm text-gray-700 underline min-h-[44px]"
                        >
                          Promouvoir admin
                        </button>
                      ) : (
                        <button
                          type="button" disabled={busy}
                          onClick={() => setRole(member.userId, 'member')}
                          className="text-sm text-gray-700 underline min-h-[44px]"
                        >
                          Rétrograder membre
                        </button>
                      )}

                      <button
                        type="button" disabled={busy}
                        onClick={() => transferOwnership(member.userId, name)}
                        className="text-sm text-gray-700 underline min-h-[44px]"
                      >
                        Transmettre le groupe
                      </button>

                      <button
                        type="button" disabled={busy}
                        onClick={() => removeMember(member.userId, name)}
                        className="text-sm text-red-700 underline min-h-[44px]"
                      >
                        Retirer
                      </button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {myRole && (
        <div className="space-y-3">
          {/* G-04 : le proprietaire doit transmettre avant de partir. Le lui
              dire ici evite de le laisser buter sur un refus de l'API. */}
          {isOwner ? (
            <Alert>
              Vous êtes propriétaire de ce groupe. Pour le quitter, transmettez-le d'abord à un
              autre membre.
            </Alert>
          ) : (
            <Button type="button" variant="secondary" onClick={leave} disabled={busy} full>
              Quitter le groupe
            </Button>
          )}

          {isOwner && (
            <Button type="button" variant="danger" onClick={removeGroup} disabled={busy} full>
              Supprimer le groupe
            </Button>
          )}
        </div>
      )}

      {!canAdmin && (
        <div className="mt-4">
          <ReportDialog targetType="group" targetId={group.id} label="Signaler ce groupe" />
        </div>
      )}
    </div>
  );
};

export default GroupDetail;
