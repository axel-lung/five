import { useEffect, useState } from 'react';
import { currentUser } from './client';

/**
 * Utilisateur mis en cache a la connexion, lu de maniere asynchrone.
 *
 * Le web lisait `localStorage` en plein rendu ; le coffre natif est
 * asynchrone, d'ou ce hook. Il ne sert qu'a repondre « est-ce moi ? » dans
 * les listes (`player.id === me?.id`) : pour tout ce qui depend du role ou
 * d'un champ modifiable a chaud, c'est `useProfile` qu'il faut utiliser.
 */
export const useCurrentUser = () => {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    currentUser().then((value) => {
      if (alive) setUser(value);
    });
    return () => {
      alive = false;
    };
  }, []);

  return user;
};
