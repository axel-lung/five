import api from './client';

/**
 * Adresse absolue d'un lien partageable vers le client web.
 *
 * Un lien d'invitation ou de session part sur WhatsApp, vers des gens qui
 * n'ont pas l'application : il doit donc pointer sur le site web public, pas
 * sur un schema d'application. L'origine se deduit de celle de l'API, dont
 * elle ne differe que par le suffixe `/api` — meme raisonnement que
 * `mediaSrc`.
 */
export const publicUrl = (path: string) => {
  if (path.startsWith('http')) return path;

  const base = (api.defaults.baseURL ?? '').replace(/\/api$/, '');
  return `${base}${path}`;
};
