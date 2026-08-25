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

  /**
   * S-01 : un message vient d'arriver par la socket de chat.
   *
   * Emis par la coque, qui tient l'unique socket, et consomme par l'ecran de
   * chat s'il est ouvert et par les pastilles sinon. Le message voyage dans
   * l'evenement plutot que de declencher un rechargement : un groupe bavard
   * ferait sinon un appel HTTP par message.
   */
  'chat:message': { groupId: string; message: any };

  /** Idem pour une suppression : la pierre tombale doit remplacer le message. */
  'chat:deleted': { groupId: string; message: any };

  /** Les non-lus du chat ont change : les pastilles doivent les relire. */
  'chat:unread': void;

  /**
   * La socket vient de (re)prendre. L'ecran de chat ouvert doit alors
   * redemander le delta `?since=` : une socket n'est pas une file durable, et
   * c'est ce rattrapage qui garantit qu'aucun message n'a ete perdu.
   */
  'chat:ready': void;
};

export const eventBus = mitt<Events>();
