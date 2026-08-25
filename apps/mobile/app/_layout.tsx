import '../global.css';

import { Slot, router } from 'expo-router';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { setOnSessionExpired } from 'five-api-client';

export default function RootLayout() {
  useEffect(() => {
    // L'intercepteur axios vit hors de l'arbre React : c'est ici qu'on lui
    // branche le routeur, une seule fois, pour qu'un refresh token expire
    // renvoie vers la connexion au lieu de laisser l'ecran en erreur.
    setOnSessionExpired(() => router.replace('/login'));
    return () => setOnSessionExpired(null);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Slot />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
