import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from 'five-api-client';
import {
  Alert,
  Button,
  Field,
  Input,
  Loading,
  PageTitle,
  Select,
} from 'five-ui';
import Screen from '../../../components/Screen';

export default function CreateGroup() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    city: '',
    accessType: 'private',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleChange = (
    field: keyof typeof formData,
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (error) setError(null);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setNotice(null);

    // Basic validation
    if (!formData.name.trim()) {
      setError('Le nom du groupe est requis');
      setLoading(false);
      return;
    }

    try {
      // Remove empty fields to avoid sending empty strings where Joi expects a value
      const payload = Object.fromEntries(
        Object.entries(formData).filter(([, value]) => value !== '')
      );

      const response = await api.post('/groups', payload);
      setNotice('Groupe créé avec succès !');

      // Navigate to the group detail screen
      router.replace(`/groupes/${response.data.id}`);
    } catch (err: any) {
      const data = err.response?.data;
      setError(
        data?.details?.[0] ?? data?.message ?? 'Création impossible'
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading && !notice) return <Loading />;

  return (
    <Screen>
      <PageTitle subtitle="Le noyau de joueurs que vous retrouvez chaque semaine.">
        Créer un groupe
      </PageTitle>

      {error ? (
        <View className="mb-4">
          <Alert kind="error">{error}</Alert>
        </View>
      ) : null}

      {notice ? (
        <View className="mb-4">
          <Alert kind="success">{notice}</Alert>
        </View>
      ) : null}

      {/* Pas de <form> : il n'existe pas en React Native, et il n'y a rien a
          soumettre — c'est le bouton qui declenche l'envoi. */}
      <View className="gap-4">
        <Field label="Nom du groupe" hint="Ex: Les Rémois">
          <Input
            testID="create-group-name"
            value={formData.name}
            onChangeText={(value) => handleChange('name', value)}
            editable={!loading}
            placeholder="Les Rémois"
          />
        </Field>

        <Field label="Ville" hint="Ex: Reims">
          <Input
            testID="create-group-city"
            value={formData.city}
            onChangeText={(value) => handleChange('city', value)}
            editable={!loading}
            placeholder="Reims"
          />
        </Field>

        <Field label="Description" hint="Description du groupe (facultatif)">
          <Input
            testID="create-group-description"
            value={formData.description}
            onChangeText={(value) => handleChange('description', value)}
            editable={!loading}
            placeholder="Groupe de cinq à Reims"
            multiline
          />
        </Field>

        <Field
          label="Visibilité"
          hint="Un groupe privé n'est visible que de ses membres."
        >
          <Select
            testID="create-group-accessType"
            value={formData.accessType}
            options={[
              { value: 'private', label: 'Privé' },
              { value: 'public', label: 'Public' },
            ]}
            onChange={(value) => handleChange('accessType', value)}
            placeholder="Privé"
            disabled={loading}
          />
        </Field>

        <Button
          testID="create-group-submit"
          onPress={handleSubmit}
          disabled={loading}
          full
        >
          {loading ? 'Création…' : 'Créer le groupe'}
        </Button>
      </View>
    </Screen>
  );
}