import { useEffect, useState } from 'react';
import { hasSession } from './client';

/**
 * Presence d'un access token, sans appel reseau.
 *
 * Le garde de route se contente de cette question — comme le faisait la
 * lecture directe de localStorage sur le web. La difference, c'est que le
 * coffre natif est asynchrone : il y a donc un etat « je ne sais pas encore »,
 * pendant lequel il ne faut surtout pas rediriger, sous peine d'ejecter vers
 * l'ecran de connexion un utilisateur pourtant connecte.
 */
export const useHasSession = () => {
  const [state, setState] = useState<{ checking: boolean; authenticated: boolean }>({
    checking: true,
    authenticated: false,
  });

  useEffect(() => {
    let alive = true;

    hasSession().then((authenticated) => {
      if (alive) setState({ checking: false, authenticated });
    });

    return () => {
      alive = false;
    };
  }, []);

  return state;
};
