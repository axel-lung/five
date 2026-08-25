import api from './client';

/**
 * Adresse absolue d'un media servi par l'API.
 *
 * L'API renvoie un chemin relatif (`/api/media/<cle>`) qu'il faut prefixer de
 * son origine. Sur le web c'etait deja necessaire en developpement, ou le
 * front et l'API ne partagent pas la meme origine ; sur natif ca l'est
 * toujours, puisqu'il n'y a aucune origine implicite a laquelle se rattacher.
 */
export const mediaSrc = (url?: string | null) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;

  const base = (api.defaults.baseURL ?? '').replace(/\/api$/, '');
  return `${base}${url}`;
};
