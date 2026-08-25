import mitt from 'mitt';

/**
 * Petit bus d'evenements applicatifs.
 *
 * Le web passait par `window.dispatchEvent` / `addEventListener`, qui n'existe
 * pas sur natif. `mitt` fait la meme chose en ~200 octets, sans introduire de
 * gestionnaire d'etat global : les deux seuls emetteurs de l'application sont
 * l'ecran notifications et la barre de navigation qui porte le badge.
 */
type Events = {
  /** Le compteur de non-lues a change : la navigation doit le relire. */
  'notifications:refresh': void;
};

export const eventBus = mitt<Events>();
