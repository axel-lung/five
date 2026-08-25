/**
 * Stockage de session, abstrait derriere une interface parce que les deux
 * cibles n'ont pas le meme coffre : localStorage sur le web, expo-secure-store
 * sur natif — et SecureStore est asynchrone, donc tout l'est.
 */
export interface SessionStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const ACCESS_TOKEN_KEY = 'access_token';
export const REFRESH_TOKEN_KEY = 'refresh_token';
export const USER_KEY = 'user';
