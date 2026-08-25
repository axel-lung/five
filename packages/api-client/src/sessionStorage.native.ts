import * as SecureStore from 'expo-secure-store';
import type { SessionStorage } from './types';

/**
 * Trousseau iOS / Keystore Android via expo-secure-store.
 *
 * Les lectures sont gardees : un coffre corrompu ou inaccessible (device
 * verrouille au demarrage) doit se traduire par « pas de session », pas par un
 * plantage au lancement de l'app.
 */
export const sessionStorage: SessionStorage = {
  async getItem(key) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },

  async setItem(key, value) {
    await SecureStore.setItemAsync(key, value);
  },

  async removeItem(key) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Supprimer une cle absente ne doit pas interrompre une deconnexion.
    }
  },
};
