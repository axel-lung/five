import React from 'react';
import { Pressable, Text } from 'react-native';
import { Link } from 'expo-router';
import { Card } from 'five-ui';

/**
 * Liens qui ont l'apparence d'un bouton ou d'une carte.
 *
 * `asChild` autour d'un `Pressable` plutot qu'un `Button` : react-native-web
 * transmet `href` a l'element rendu, ce qui produit une vraie balise `<a>` sur
 * le web — donc un clic milieu, un « ouvrir dans un nouvel onglet » et un
 * survol qui montre la destination, que la navigation par `onPress` seule
 * ferait perdre.
 */
export const LinkButton: React.FC<{
  href: string;
  children: string;
  variant?: 'primary' | 'secondary';
  className?: string;
}> = ({ href, children, variant = 'primary', className = '' }) => (
  <Link href={href as never} asChild>
    <Pressable
      accessibilityRole="link"
      className={`min-h-[44px] px-5 rounded-lg items-center justify-center ${
        variant === 'primary'
          ? 'bg-green-600 active:bg-green-700'
          : 'bg-white border border-gray-300 active:bg-gray-50'
      } ${className}`}
    >
      <Text
        className={`font-semibold ${variant === 'primary' ? 'text-white' : 'text-gray-800'}`}
      >
        {children}
      </Text>
    </Pressable>
  </Link>
);

export const LinkCard: React.FC<{
  href: string;
  children: React.ReactNode;
  className?: string;
}> = ({ href, children, className = '' }) => (
  <Link href={href as never} asChild>
    <Pressable accessibilityRole="link">
      <Card className={className}>{children}</Card>
    </Pressable>
  </Link>
);
