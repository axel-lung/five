import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { mediaSrc } from '../components/AvatarUpload';
import { Alert, Button, Card, Loading, PageTitle } from '../components/ui';

/** D-06 : les joueurs que j'ai bloques. Jamais ceux qui m'ont bloque. */
const Blocks: React.FC = () => {
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await api.get('/users/me/blocks');
      setBlocks(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unblock = async (userId: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/users/${userId}/block`);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Déblocage impossible');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="max-w-md mx-auto">
      <PageTitle subtitle="Ces joueurs ne peuvent ni vous inviter, ni rejoindre vos sessions.">
        Joueurs bloqués
      </PageTitle>

      {error && (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      {blocks.length === 0 ? (
        <Card>
          <p className="text-gray-600">Vous n'avez bloqué personne.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {blocks.map((block) => {
            const name =
              [block.user?.firstName, block.user?.lastName].filter(Boolean).join(' ') || 'Joueur';
            const avatar = mediaSrc(block.user?.avatarUrl);

            return (
              <Card key={block.user.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {avatar ? (
                      <img src={avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        👤
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-900 truncate">{name}</span>
                  </div>

                  <Button
                    type="button" variant="secondary" disabled={busy}
                    onClick={() => unblock(block.user.id)}
                  >
                    Débloquer
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Blocks;
