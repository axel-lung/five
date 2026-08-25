import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { sessionStorage } from './sessionStorage';
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY } from './types';

const baseURL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api';

const api = axios.create({ baseURL });

export const setSession = async (accessToken: string, refreshToken: string, user: unknown) => {
  await sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  await sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  await sessionStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearSession = async () => {
  await sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  await sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  await sessionStorage.removeItem(USER_KEY);
};

export const currentUser = async () => {
  const raw = await sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/**
 * Rafraichit le profil garde en cache apres une modification.
 *
 * Sans ca, le prenom affiche sur le tableau de bord resterait celui de la
 * connexion jusqu'a la suivante.
 */
export const setStoredUser = async (user: unknown) => {
  await sessionStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const hasSession = async () => Boolean(await sessionStorage.getItem(ACCESS_TOKEN_KEY));

/**
 * L'intercepteur vit hors de l'arbre React : il n'a acces ni au routeur, ni a
 * un etat de composant. Le web s'en sortait avec `window.location.href`, qui
 * n'existe pas sur natif. La navigation est donc deleguee a l'app, qui
 * s'abonne ici une fois au demarrage.
 */
type SessionExpiredHandler = () => void;

let onSessionExpired: SessionExpiredHandler | null = null;

export const setOnSessionExpired = (handler: SessionExpiredHandler | null) => {
  onSessionExpired = handler;
};

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await sessionStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Rejoue une requete une fois apres avoir rafraichi l'access token.
 *
 * L'access token dure une heure : sans ce rattrapage, un organisateur qui
 * laisse l'app ouverte pendant un match se fait deconnecter en plein parcours.
 * Le refresh token, lui, dure trente jours.
 *
 * Les rafraichissements concurrents partagent la meme promesse : trois
 * requetes qui echouent ensemble ne doivent pas produire trois rotations de
 * token, dont deux seraient perdues.
 */
let refreshing: Promise<string> | null = null;

const refreshAccessToken = async (): Promise<string> => {
  const refreshToken = await sessionStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    throw new Error('no refresh token');
  }

  const response = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
  await sessionStorage.setItem(ACCESS_TOKEN_KEY, response.data.accessToken);
  await sessionStorage.setItem(REFRESH_TOKEN_KEY, response.data.refreshToken);
  return response.data.accessToken;
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;

    // `/auth/` est exclu : un mot de passe errone renvoie lui aussi 401, et le
    // rejouer en boucle n'aurait aucun sens.
    const retriable =
      error.response?.status === 401 &&
      original &&
      !original._retried &&
      !original.url?.includes('/auth/');

    if (!retriable || !original) {
      return Promise.reject(error);
    }

    original._retried = true;

    try {
      if (!refreshing) {
        refreshing = refreshAccessToken().finally(() => {
          refreshing = null;
        });
      }
      const token = await refreshing;
      original.headers.Authorization = `Bearer ${token}`;
      return api(original);
    } catch {
      await clearSession();
      onSessionExpired?.();
      return Promise.reject(error);
    }
  }
);

export default api;
