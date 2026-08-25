import { useEffect, useState } from 'react';
import api, { currentUser, hasSession } from './client';

/**
 * Profil courant, relu depuis l'API.
 *
 * Le stockage local porte le profil du moment de la connexion : il ne connait
 * ni le role, ni l'avatar televerse depuis, ni la verification d'email faite
 * entre-temps. Les ecrans qui dependent de ces champs doivent relire l'API.
 *
 * Le role en particulier ne doit jamais venir du stockage local : c'est lui
 * qui decide l'affichage de l'entree back-office, et il se revoque a chaud.
 */
export type Profile = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  city?: string | null;
  bio?: string | null;
  phone?: string | null;
  preferredPosition?: string | null;
  selfDeclaredLevel?: number | null;
  preferredSlots?: string[];
  travelRadiusKm?: number | null;
  emailVerified?: boolean;
  role?: 'user' | 'admin';
};

export const useProfile = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (!(await hasSession())) {
          return;
        }

        const res = await api.get('/users/profile');
        if (alive) setProfile(res.data);
      } catch {
        // Hors ligne ou API injoignable : le cache local vaut mieux qu'un
        // ecran vide, meme s'il peut etre en retard d'un champ.
        if (alive) setProfile(await currentUser());
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return { profile, loading, setProfile };
};
