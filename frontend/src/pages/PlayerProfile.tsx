import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { currentUser } from '../services/api';
import { mediaSrc } from '../components/AvatarUpload';
import ReportDialog from '../components/ReportDialog';
import { Alert, Button, Card, Loading, PageTitle } from '../components/ui';

/**
 * D-02 : profil public minimal d'un autre joueur.
 *
 * L'API ne renvoie que ce qui est partageable, et repond 404 quand un
 * blocage existe dans un sens ou dans l'autre. L'ecran n'a donc rien a
 * filtrer lui-meme.
 */
const PlayerProfile: React.FC = () => {
  const { userId } = useParams();
  const [player, setPlayer] = useState<any>(null);
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const me = currentUser();
  const navigate = useNavigate();
  const isMe = userId === me?.id;

  useEffect(() => {
    api
      .get(`/users/${userId}`)
      .then((res) => setPlayer(res.data))
      .catch((err) => setError(err.response?.data?.message ?? 'Joueur introuvable'))
      .finally(() => setLoading(false));
  }, [userId]);

  const block = async () => {
    if (!window.confirm("Bloquer ce joueur ? Vous ne pourrez plus vous inviter ni rejoindre les sessions de l'autre.")) {
      return;
    }

    setBusy(true);
    try {
      await api.post(`/users/${userId}/block`);
      setBlocked(true);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Blocage impossible');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading />;
  if (error && !player) return <Alert kind="error">{error}</Alert>;

  if (blocked) {
    return (
      <div className="max-w-md mx-auto">
        <Alert kind="success">Joueur bloqué.</Alert>
        <Button type="button" variant="secondary" onClick={() => navigate(-1)} full className="mt-4">
          Retour
        </Button>
      </div>
    );
  }

  const name = [player.firstName, player.lastName].filter(Boolean).join(' ') || 'Joueur';
  const avatar = mediaSrc(player.avatarUrl);

  return (
    <div className="max-w-md mx-auto">
      <PageTitle subtitle={player.city ?? undefined}>{name}</PageTitle>

      {error && (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      <Card className="mb-4">
        <div className="flex items-center gap-4">
          {avatar ? (
            <img src={avatar} alt="" className="w-20 h-20 rounded-full object-cover border border-gray-200" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-3xl">
              👤
            </div>
          )}

          <dl className="text-sm space-y-1">
            {player.preferredPosition && (
              <div className="flex gap-2">
                <dt className="text-gray-500">Poste</dt>
                <dd className="font-medium text-gray-900">{player.preferredPosition}</dd>
              </div>
            )}
            {player.selfDeclaredLevel && (
              <div className="flex gap-2">
                <dt className="text-gray-500">Niveau</dt>
                <dd className="font-medium text-gray-900">{player.selfDeclaredLevel} / 5</dd>
              </div>
            )}
          </dl>
        </div>
      </Card>

      {/* D-06 / S-05 : on ne se bloque ni ne se signale soi-meme. */}
      {!isMe && (
        <div className="space-y-3">
          <Button type="button" variant="secondary" onClick={block} disabled={busy} full>
            Bloquer ce joueur
          </Button>
          <ReportDialog targetType="user" targetId={userId!} label="Signaler ce joueur" />
        </div>
      )}
    </div>
  );
};

export default PlayerProfile;
