import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { clearSession, currentUser } from '../services/api';
import { Alert, Button, Card, inputClass, PageTitle } from '../components/ui';

/** Saisie exigee pour confirmer l'effacement : un clic seul est trop facile. */
const CONFIRMATION = 'SUPPRIMER';

/**
 * C-06 : export et effacement du compte.
 *
 * L'effacement est irreversible et deplace la propriete des groupes. Il est
 * donc protege par une saisie explicite, et ses consequences sont ecrites
 * avant le bouton, pas apres.
 */
const ProfileData: React.FC = () => {
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const navigate = useNavigate();

  const exportData = async () => {
    setBusy(true);
    setError(null);

    try {
      const response = await api.get('/users/me/export');

      // Telechargement local : le JSON est deja en memoire, inutile de
      // repasser par le reseau avec un lien.
      const blob = new Blob([JSON.stringify(response.data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `five-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);

      setNotice('Export téléchargé.');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Export impossible');
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    setBusy(true);
    setError(null);

    try {
      await api.delete('/users/me');
      clearSession();
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Suppression impossible');
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <PageTitle subtitle={currentUser()?.email}>Mes données</PageTitle>

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

      <Card className="mb-6">
        <h2 className="font-semibold text-gray-900 mb-1">Exporter mes données</h2>
        <p className="text-sm text-gray-600 mb-3">
          Un fichier JSON avec votre profil, vos groupes, vos sessions et vos inscriptions.
        </p>
        <Button type="button" variant="secondary" onClick={exportData} disabled={busy} full>
          Télécharger mes données
        </Button>
      </Card>

      <Card className="border-red-200">
        <h2 className="font-semibold text-red-800 mb-1">Supprimer mon compte</h2>
        <div className="text-sm text-gray-700 space-y-2 mb-4">
          <p>Cette action est irréversible. Concrètement :</p>
          <ul className="list-disc list-inside space-y-1 text-gray-600">
            <li>vos informations personnelles sont effacées&nbsp;;</li>
            <li>
              les groupes dont vous êtes propriétaire sont transmis à un autre membre, ou
              supprimés si vous êtes seul&nbsp;;
            </li>
            <li>vos sessions à venir sont annulées et les inscrits prévenus&nbsp;;</li>
            <li>
              les sessions passées restent, pour ne pas effacer l'historique des autres
              joueurs.
            </li>
          </ul>
        </div>

        <label htmlFor="confirmation" className="block text-sm font-medium text-gray-700 mb-1">
          Tapez <span className="font-mono font-bold">{CONFIRMATION}</span> pour confirmer
        </label>
        <input
          id="confirmation"
          type="text"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          className={`${inputClass} mb-3`}
          autoComplete="off"
        />

        <Button
          type="button"
          variant="danger"
          onClick={deleteAccount}
          disabled={busy || confirmation !== CONFIRMATION}
          full
        >
          {busy ? '…' : 'Supprimer définitivement mon compte'}
        </Button>
      </Card>
    </div>
  );
};

export default ProfileData;
