import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import { Alert, Card, Loading, PageTitle } from '../components/ui';

/**
 * C-05 : validation du lien de verification.
 *
 * Ecran public : le jeton fait foi, et le lien arrive par email, souvent
 * ouvert dans un navigateur ou la session n'existe pas.
 */
const VerifyEmail: React.FC = () => {
  const { token } = useParams();
  const [state, setState] = useState<'pending' | 'ok' | 'error'>('pending');
  const [message, setMessage] = useState('');

  // Le jeton est consomme a la premiere validation. Sans ce garde, le double
  // appel des effets en mode strict envoie une seconde requete sur un jeton
  // deja consomme, dont le 404 ecrase le succes affiche.
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    api
      .post(`/auth/verify-email/${token}`)
      .then(() => setState('ok'))
      .catch((err) => {
        setState('error');
        setMessage(err.response?.data?.message ?? 'Lien invalide ou expiré');
      });
  }, [token]);

  if (state === 'pending') return <Loading label="Vérification…" />;

  return (
    <div className="max-w-md mx-auto py-6">
      <PageTitle>Vérification de l'email</PageTitle>

      <Card>
        {state === 'ok' ? (
          <>
            <Alert kind="success">Votre adresse email est vérifiée.</Alert>
            <Link
              to="/dashboard"
              className="mt-4 min-h-[44px] flex items-center justify-center rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition"
            >
              Continuer
            </Link>
          </>
        ) : (
          <>
            <Alert kind="error">{message}</Alert>
            <Link
              to="/profil"
              className="mt-4 min-h-[44px] flex items-center justify-center rounded-lg bg-white border border-gray-300 hover:bg-gray-50 font-semibold transition"
            >
              Demander un nouveau lien
            </Link>
          </>
        )}
      </Card>
    </div>
  );
};

export default VerifyEmail;
