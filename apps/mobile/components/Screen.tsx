import React from 'react';
import { ScrollView } from 'react-native';

/**
 * Contenu defilant d'un ecran.
 *
 * Sur le web le defilement est celui du document ; en React Native il faut le
 * demander explicitement, et c'est une erreur facile a oublier ecran par
 * ecran. `className` recoit la largeur voulue (`max-w-md` pour les
 * formulaires, rien pour les listes pleine largeur).
 */
export const Screen: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <ScrollView
    className="flex-1"
    // Sans ca, un appui sur un bouton alors que le clavier est ouvert ne fait
    // que refermer le clavier, et le joueur doit appuyer deux fois.
    keyboardShouldPersistTaps="handled"
    contentContainerClassName={`grow w-full ${className}`}
  >
    {children}
  </ScrollView>
);

export default Screen;
