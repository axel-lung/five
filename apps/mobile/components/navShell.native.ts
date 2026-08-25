import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Natif : la barre d'onglets occupe sa place dans la colonne, comme toute
 * barre d'onglets systeme. Pas de calque flottant, donc pas de reserve de
 * hauteur a prevoir sur le contenu.
 */
export const shellMainClass = '';

export const navBarClass = 'bg-white border-t border-gray-200 sm:bg-gray-800 sm:border-0';

/**
 * `env(safe-area-inset-bottom)` est une notion de feuille de style : sur natif
 * la meme mesure se lit sur le contexte de zone sure.
 */
export const useNavBarInset = (): number | undefined => useSafeAreaInsets().bottom;
