import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { currentUser } from '../services/api';
import ShareButton from '../components/ShareButton';
import { Alert, Button, Card, inputClass, Loading, PageTitle } from '../components/ui';

const roleLabels: Record<string, string> = {
  owner: 'Propriétaire',
  admin: 'Admin',
  member: 'Membre',
};

const GroupDetail: React.FC = () => {
  const { groupId } = useParams();
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [invitation, setInvitation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const me = currentUser();

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.get(`/groups/${groupId}`);
        setGroup(response.data);
      } catch (err: any) {
        setError(err.response?.data?.message ?? 'Groupe introuvable');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [groupId]);

  // G-05 : la recherche est faite par l'API, pas en local — la liste peut
  // depasser ce qu'on veut charger d'un coup.
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
    // Petit delai : sans lui, chaque frappe declenche une requete.
    const timer = setTimeout(loadMembers, 250);
    return () => clearTimeout(timer);
  }, [loadMembers]);

  if (loading) return <Loading />;
  if (error && !group) return <Alert kind="error">{error}</Alert>;

  const myRole = members.find((m) => m.userId === me?.id)?.role;
  const canInvite = myRole === 'owner' || myRole === 'admin';

  const createInvitation = async () => {
    setError(null);
    try {
      const response = await api.post(`/groups/${groupId}/invitations`, {});
      setInvitation(response.data.token);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Création du lien impossible');
    }
  };

  return (
    <div>
      <PageTitle subtitle={group.city ?? undefined}>{group.name}</PageTitle>

      {group.description && <p className="text-gray-700 mb-4">{group.description}</p>}

      {error && (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      <div className="mb-6">
        <Link
          to={`/sessions/nouvelle?groupId=${group.id}`}
          className="min-h-[44px] flex items-center justify-center rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition"
        >
          Créer une session pour ce groupe
        </Link>
      </div>

      {/* G-02 : le lien d'invitation, coeur du parcours « rejoindre un groupe ». */}
      {canInvite && (
        <Card className="mb-6">
          <h2 className="font-semibold text-gray-900 mb-1">Inviter des joueurs</h2>
          <p className="text-sm text-gray-600 mb-3">
            Un lien valable 7 jours, à envoyer sur WhatsApp.
          </p>

          {invitation ? (
            <ShareButton
              url={`/invitation/${invitation}`}
              text={`Rejoins ${group.name} sur Five :`}
            />
          ) : (
            <Button onClick={createInvitation} full>
              Générer un lien d'invitation
            </Button>
          )}
        </Card>
      )}

      <section>
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
          <Card>
            <ul className="divide-y divide-gray-100">
              {members.map((member) => (
                <li key={member.id} className="py-2 flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-800 truncate">
                    {[member.user?.firstName, member.user?.lastName].filter(Boolean).join(' ') ||
                      'Compte supprimé'}
                    {member.userId === me?.id && <span className="text-gray-400"> — vous</span>}
                  </span>
                  <span className="text-xs text-gray-500 shrink-0">
                    {roleLabels[member.role] ?? member.role}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
};

export default GroupDetail;
