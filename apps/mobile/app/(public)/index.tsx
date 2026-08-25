import React from 'react';
import { Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useHasSession } from 'five-api-client';
import { Loading } from 'five-ui';
import Screen from '../../components/Screen';
import { LinkButton } from '../../components/links';

export default function Home() {
  const { checking, authenticated } = useHasSession();

  if (checking) return <Loading />;
  if (authenticated) return <Redirect href="/dashboard" />;

  return (
    <Screen className="py-10 items-center">
      <Text className="text-3xl sm:text-4xl font-bold text-gray-900 text-center">
        Le five, sans les relances
      </Text>

      <Text className="mt-3 text-gray-600 text-center max-w-md">
        Créez la session, partagez le lien, et voyez qui vient. La liste d'attente se remplit
        toute seule quand quelqu'un se désiste.
      </Text>

      <View className="mt-8 flex-col sm:flex-row gap-3 w-full max-w-md">
        <LinkButton href="/register" className="sm:flex-1">
          Créer un compte
        </LinkButton>
        <LinkButton href="/login" variant="secondary" className="sm:flex-1">
          J'ai déjà un compte
        </LinkButton>
      </View>
    </Screen>
  );
}
