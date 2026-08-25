import { useState } from 'react';
import { Text, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { api, setSession } from 'five-api-client';
import { Alert, Button, Field, Input, PageTitle } from 'five-ui';
import Screen from '../../components/Screen';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();

  // Renvoie le joueur la ou il allait avant d'etre intercepte : un lien
  // d'invitation recu par WhatsApp ne doit pas se perdre dans la connexion.
  const destination = redirect || '/dashboard';

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/auth/login', { email, password });
      const { user, accessToken, refreshToken } = response.data;
      await setSession(accessToken, refreshToken, user);
      router.replace(destination as never);
    } catch (err: any) {
      // Un compte suspendu recoit 403 et un motif : le lui dire, il est le
      // seul cas ou l'utilisateur peut agir (contacter le support).
      const data = err.response?.data;
      setError(
        data?.reason ? `${data.message} — ${data.reason}` : data?.message ?? 'Connexion impossible'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen className="max-w-md self-center">
      <PageTitle subtitle="Retrouvez vos groupes et vos sessions.">Connexion</PageTitle>

      {error ? (
        <View className="mb-4">
          <Alert kind="error">{error}</Alert>
        </View>
      ) : null}

      <View className="gap-4">
        <Field label="Email">
          <Input
            testID="login-email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
            editable={!loading}
          />
        </Field>

        <Field label="Mot de passe">
          <Input
            testID="login-password"
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            editable={!loading}
            onSubmitEditing={handleSubmit}
          />
        </Field>

        <Button testID="login-submit" onPress={handleSubmit} disabled={loading} full>
          {loading ? 'Connexion…' : 'Se connecter'}
        </Button>
      </View>

      <Text className="text-center text-sm text-gray-600 mt-6">
        Pas encore de compte ?{' '}
        <Link href="/register" className="text-green-700 font-semibold underline">
          Créer un compte
        </Link>
      </Text>
    </Screen>
  );
}
