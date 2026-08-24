import { useEffect, useState } from 'react';
import api, { currentUser } from './api';

/**
 * Profil courant, relu depuis l'API.
 *
 * localStorage porte le profil du moment de la connexion : il ne connait ni
 * le role, ni l'avatar televerse depuis, ni la verification d'email faite
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

    if (!localStorage.getItem('access_token')) {
      setLoading(false);
      return;
    }

    api
      .get('/users/profile')
      .then((res) => {
        if (!alive) return;
        setProfile(res.data);
        // Garde le cache local coherent pour les ecrans qui s'en contentent.
        localStorage.setItem('user', JSON.stringify(res.data));
      })
      .catch(() => {
        if (alive) setProfile(currentUser());
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  return { profile, loading, setProfile };
};
