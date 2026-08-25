import React from 'react';
import { Text } from 'react-native';
import { Card, PageTitle } from 'five-ui';
import Screen from './Screen';

/**
 * Ecran encore a porter.
 *
 * Il existe pour que les liens de la phase 1 aboutissent quelque part : sans
 * lui, une navigation vers une route absente afficherait l'ecran « page
 * introuvable » d'Expo Router, qu'on ne saurait pas distinguer d'un bug.
 */
export const ComingSoon: React.FC<{ title: string; children: string }> = ({
  title,
  children,
}) => (
  <Screen className="max-w-md self-center">
    <PageTitle>{title}</PageTitle>
    <Card>
      <Text className="text-gray-600">{children}</Text>
      <Text className="text-xs text-gray-400 mt-3">Écran provisoire — arrive en phase 2.</Text>
    </Card>
  </Screen>
);

export default ComingSoon;
