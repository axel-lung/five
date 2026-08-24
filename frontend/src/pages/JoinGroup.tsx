import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { Alert, Button, Card, Loading, PageTitle } from '../components/ui';

/**
 * Parcours critique « rejoindre un groupe » (G-02, G-04).
 *
 * L'apercu est volontairement consultable sans compte : le lien circule sur
 * WhatsApp, et demander de creer un compte avant meme de savoir de quel
 * groupe il s'agit ferait perdre la moitie des invites. La creation de compte
 * n'intervient qu'au moment d'accepter, et l'on revient ici ensuite.
 */
const JoinGroup: React.FC = () => {
  const { token } = useParams();
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const connected = Boolean(localStorage.getItem('access_token'));

  useEffect(() => {
    api
      .get(`/groups/invitations/${token}`)
      .then((res) => setPreview(res.data))
      .catch((err) =>
        setError(err.response?.data?.message ?? "Cette invitation n'est plus valable")
      )
      .finally(() => setLoading(false));
  }, [token]);

  const accept = async () => {
    if (!connected) {
      // On memorise l'invitation : apres connexion, le joueur retombe ici.
      navigate('/login', { state: { from: location } });
      return;
    }

    setJoining(true);
    setError(null);

    try {
      const response = await api.post(`/groups/invitations/${token}/accept`);
      navigate(`/groups/${response.data.groupId}`, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Impossible de rejoindre ce groupe');
      setJoining(false);
    }
  };

  if (loading) return <Loading />;
  if (error && !preview) return <Alert kind="error">{error}</Alert>;

  return (
    <div className="max-w-md mx-auto py-6">
      <PageTitle subtitle="Vous êtes invité à rejoindre ce groupe.">Invitation</PageTitle>

      <Card className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">{preview.group.name}</h2>
        {preview.group.city && <p className="text-gray-600">{preview.group.city}</p>}
        {preview.group.description && (
          <p className="text-sm text-gray-700 mt-3">{preview.group.description}</p>
        )}
        <p className="text-sm text-gray-500 mt-3">
          {preview.memberCount} membre{preview.memberCount > 1 ? 's' : ''}
        </p>
      </Card>

      {error && (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      <Button onClick={accept} disabled={joining} full>
        {joining ? '…' : connected ? 'Rejoindre le groupe' : 'Se connecter pour rejoindre'}
      </Button>
    </div>
  );
};

export default JoinGroup;
