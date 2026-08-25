import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api } from 'five-api-client';
import { Alert, Card, Loading, PageTitle } from 'five-ui';
import Screen from '../../../components/Screen';
import { LinkButton } from '../../../components/links';

/**
 * C-05 : validation du lien de verification.
 *
 * Ecran public : le jeton fait foi, et le lien arrive par email, souvent
 * ouvert dans un navigateur ou la session n'existe pas.
 */
export default function VerifyEmail() {
  const { token } = useLocalSearchParams<{ token: string }>();
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
    <Screen className="max-w-md self-center">
      <PageTitle>Vérification de l'email</PageTitle>

      <Card>
        {state === 'ok' ? (
          <>
            <Alert kind="success">Votre adresse email est vérifiée.</Alert>
            <View className="mt-4">
              <LinkButton href="/dashboard">Continuer</LinkButton>
            </View>
          </>
        ) : (
          <>
            <Alert kind="error">{message}</Alert>
            <View className="mt-4">
              <LinkButton href="/profil" variant="secondary">
                Demander un nouveau lien
              </LinkButton>
            </View>
          </>
        )}
      </Card>
    </Screen>
  );
}
