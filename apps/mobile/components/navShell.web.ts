/**
 * Web : la barre d'onglets est fixee en bas du viewport sur telephone, puis
 * repasse dans le flux sous l'en-tete a partir de `sm:`.
 *
 * L'ordre du flux ne suit pas l'ordre de l'arbre : la barre est rendue apres
 * le contenu, parce que c'est le seul ordre qui tienne debout sur natif (un
 * calque absolu place avant le contenu se ferait voler ses appuis par la zone
 * defilante). `sm:order-*` remet les trois blocs dans l'ordre visuel voulu,
 * ce qui evite de dupliquer la navigation ou de dedoubler la mise en page.
 */
export const shellMainClass = 'pb-24 sm:pb-6 sm:order-3';

export const navBarClass =
  'fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 ' +
  // Evite que la barre passe sous l'indicateur d'accueil des iPhone sans bouton.
  'pb-[env(safe-area-inset-bottom)] sm:order-2 sm:relative sm:bg-gray-800 sm:border-0 sm:pb-1';

/**
 * Rien a ajouter en ligne : le retrait bas vient de la feuille de style, via
 * `env(safe-area-inset-bottom)`. Renvoyer 0 ici ecraserait cette valeur.
 */
export const useNavBarInset = (): number | undefined => undefined;
