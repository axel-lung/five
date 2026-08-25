/**
 * Fond de la coque applicative, en valeur brute.
 *
 * C'est le `bg-gray-50` des layouts. Les navigateurs (onglets, piles) peignent
 * leur propre fond derriere chaque ecran, et cette couleur est reglee par une
 * prop de style, pas par une classe : il faut donc la valeur, pas le nom.
 *
 * Ce fond doit rester **opaque**. Un fond transparent laisse voir l'ecran
 * sortant a travers l'ecran entrant pendant toute l'animation de transition.
 */
export const SHELL_BACKGROUND = '#f9fafb';
