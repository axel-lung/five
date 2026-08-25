import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { api, setSession } from 'five-api-client';
import { Alert, Button, Checkbox, Field, Input, PageTitle } from 'five-ui';
import Screen from '../../components/Screen';

export default function Register() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    city: '',
    // C-01 : consentements separes. Les CGU sont obligatoires cote API.
    acceptTos: false,
    acceptMarketing: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();

  const destination = redirect || '/dashboard';

  const set = (patch: Partial<typeof formData>) =>
    setFormData((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      // Les champs facultatifs laisses vides sont retires plutot qu'envoyes
      // a '' : Joi refuse une chaine vide la ou il attend un nom ou une
      // ville. Les booleens des consentements traversent ce filtre.
      const payload = Object.fromEntries(
        Object.entries(formData).filter(([, value]) => value !== '')
      );
      const response = await api.post('/auth/register', payload);
      const { user, accessToken, refreshToken } = response.data;
      await setSession(accessToken, refreshToken, user);
      router.replace(destination as never);
    } catch (err: any) {
      const data = err.response?.data;
      setError(data?.details?.[0] ?? data?.message ?? 'Inscription impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen className="max-w-md self-center">
      <PageTitle subtitle="Deux minutes, et vous êtes sur la prochaine session.">
        Créer un compte
      </PageTitle>

      {error ? (
        <View className="mb-4">
          <Alert kind="error">{error}</Alert>
        </View>
      ) : null}

      <View className="gap-4">
        <Field label="Email">
          <Input
            testID="register-email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            value={formData.email}
            onChangeText={(value) => set({ email: value })}
            editable={!loading}
          />
        </Field>

        <Field label="Mot de passe" hint="6 caractères minimum.">
          <Input
            testID="register-password"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            value={formData.password}
            onChangeText={(value) => set({ password: value })}
            editable={!loading}
          />
        </Field>

        <Field label="Prénom">
          <Input
            autoComplete="given-name"
            value={formData.firstName}
            onChangeText={(value) => set({ firstName: value })}
            editable={!loading}
          />
        </Field>

        <Field label="Ville">
          <Input
            value={formData.city}
            onChangeText={(value) => set({ city: value })}
            editable={!loading}
          />
        </Field>

        <View className="gap-3 pt-2">
          <Checkbox
            testID="register-tos"
            checked={formData.acceptTos}
            onChange={(value) => set({ acceptTos: value })}
            disabled={loading}
            label="J'accepte les conditions générales d'utilisation."
          />

          <Checkbox
            checked={formData.acceptMarketing}
            onChange={(value) => set({ acceptMarketing: value })}
            disabled={loading}
            label="Je souhaite recevoir les actualités de Five (facultatif)."
          />
        </View>

        <Button
          testID="register-submit"
          onPress={handleSubmit}
          disabled={loading || !formData.acceptTos}
          full
        >
          {loading ? 'Création…' : "S'inscrire"}
        </Button>
      </View>

      <Text className="text-center text-sm text-gray-600 mt-6">
        Déjà un compte ?{' '}
        <Link href="/login" className="text-green-700 font-semibold underline">
          Se connecter
        </Link>
      </Text>
    </Screen>
  );
}
