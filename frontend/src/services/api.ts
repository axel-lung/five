import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_APP_API_URL || 'http://localhost:3001/api',
});

export const setSession = (accessToken: string, refreshToken: string, user: unknown) => {
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);
  localStorage.setItem('user', JSON.stringify(user));
};

export const clearSession = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
};

export const currentUser = () => {
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Rejoue une requete une fois apres avoir rafraichi l'access token.
 *
 * L'access token dure une heure : sans ce rattrapage, un organisateur qui
 * laisse l'onglet ouvert pendant un match se fait deconnecter en plein
 * parcours. Le refresh token, lui, dure trente jours.
 *
 * Les rafraichissements concurrents partagent la meme promesse : trois
 * requetes qui echouent ensemble ne doivent pas produire trois rotations de
 * token, dont deux seraient perdues.
 */
let refreshing: Promise<string> | null = null;

const refreshAccessToken = async (): Promise<string> => {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) {
    throw new Error('no refresh token');
  }

  const response = await axios.post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken });
  localStorage.setItem('access_token', response.data.accessToken);
  localStorage.setItem('refresh_token', response.data.refreshToken);
  return response.data.accessToken;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // `/auth/` est exclu : un mot de passe errone renvoie lui aussi 401, et le
    // rejouer en boucle n'aurait aucun sens.
    const retriable =
      error.response?.status === 401 &&
      original &&
      !original._retried &&
      !original.url?.includes('/auth/');

    if (!retriable) {
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
      clearSession();
      // Rechargement plutot que navigation react-router : l'intercepteur vit
      // hors de l'arbre React et n'a pas acces au routeur.
      window.location.href = '/login';
      return Promise.reject(error);
    }
  }
);

export default api;
