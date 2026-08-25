import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';

/**
 * Mise en page des ecrans consultables sans compte : accueil, connexion,
 * inscription, apercu d'invitation et de session partagee.
 *
 * Pas de navigation par onglets — il n'y a rien a naviguer tant qu'on n'a pas
 * de compte, et la proposer donnerait l'impression d'un mur d'inscription.
 */
export default function PublicLayout() {
  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-gray-900">
        <View className="w-full max-w-4xl self-center px-4 h-14 flex-row items-center justify-between">
          <Link href="/" asChild>
            <Text className="text-lg font-bold text-white">Five</Text>
          </Link>

          <View className="flex-row items-center gap-2">
            <Link href="/login" asChild>
              <Pressable
                accessibilityRole="link"
                className="min-h-[40px] px-3 rounded-lg justify-center active:bg-gray-800"
              >
                <Text className="text-sm text-white">Connexion</Text>
              </Pressable>
            </Link>

            <Link href="/register" asChild>
              <Pressable
                accessibilityRole="link"
                className="min-h-[40px] px-3 rounded-lg justify-center bg-green-600 active:bg-green-700"
              >
                <Text className="text-sm text-white font-semibold">Créer un compte</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>

      <View className="flex-1 w-full max-w-4xl self-center px-4 py-6">
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
      </View>
    </View>
  );
}
