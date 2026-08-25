import type { SessionStorage } from './types';

/**
 * Le rendu web peut se faire hors navigateur (export statique Expo) : chaque
 * acces est garde, sinon la generation des pages plante sur `window`.
 */
export const sessionStorage: SessionStorage = {
  async getItem(key) {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  },

  async setItem(key, value) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  },

  async removeItem(key) {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  },
};
