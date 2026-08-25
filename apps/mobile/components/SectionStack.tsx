import React from 'react';
import { Stack } from 'expo-router';
import { SHELL_BACKGROUND } from './theme';

/**
 * Pile de navigation interne a un onglet.
 *
 * Chaque onglet a la sienne : c'est ce qui permet d'ouvrir un groupe depuis la
 * liste des groupes et de revenir en arriere, sans que passer d'un onglet a
 * l'autre ne demonte quoi que ce soit.
 */
export const SectionStack: React.FC = () => (
  <Stack
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: SHELL_BACKGROUND },
    }}
  />
);

export default SectionStack;
