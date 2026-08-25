import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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

export default function CreateEvent() {
  // Un objet, pas un tuple : le deballer en tableau leve « n'est pas iterable »
  // et laisse l'ecran blanc.
  const searchParams = useLocalSearchParams<{ groupId?: string }>();
  const router = useRouter();
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [venues, setVenues] = useState<Array<{ id: string; name: string; city?: string }>>([]);
  const [formData, setFormData] = useState({
    title: '',
    dateTime: '',
    location: '',
    capacity: '10',
    price: '',
    description: '',
    venueId: '',
    groupId: searchParams.groupId ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Fetch groups where user is a member
        const groupsRes = await api.get('/groups');
        const userGroups = groupsRes.data
          .filter((group: any) => group.isMember)
          .map((group: any) => ({
            id: group.id,
            name: group.name,
          }));
        setGroups(userGroups);

        // Fetch venues
        const venuesRes = await api.get('/venues');
        const formattedVenues = venuesRes.data.map((venue: any) => ({
          id: venue.id,
          name: venue.name,
          city: venue.city,
        }));
        setVenues(formattedVenues);
      } catch (err: any) {
        setError(
          err.response?.data?.message ??
            'Impossible de charger les données initiales'
        );
      }
    };

    loadInitialData();
  }, []);

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
    if (!formData.title.trim()) {
      setError('Le titre est requis');
      setLoading(false);
      return;
    }

    if (!formData.dateTime) {
      setError('La date et l\'heure sont requises');
      setLoading(false);
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        title: formData.title.trim(),
        dateTime: new Date(formData.dateTime).toISOString(),
        capacity: Number(formData.capacity),
      };

      if (formData.location.trim()) payload.location = formData.location.trim();
      if (formData.description.trim()) payload.description = formData.description.trim();
      if (formData.price) payload.price = Number(formData.price);
      if (formData.groupId) payload.groupId = formData.groupId;
      if (formData.venueId) payload.venueId = formData.venueId;

      const response = await api.post('/events', payload);
      setNotice('Session créée avec succès !');

      // Navigate to the event detail screen
      router.replace(`/sessions/${response.data.id}`);
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
      <PageTitle subtitle="Date, lieu, nombre de places. Le reste suit.">
        Créer une session
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
        <Field label="Titre" hint="Ex: Five du mardi">
          <Input
            testID="create-event-title"
            value={formData.title}
            onChangeText={(value) => handleChange('title', value)}
            editable={!loading}
            placeholder="Five du mardi"
          />
        </Field>

        <Field label="Date et heure">
          {/* Using Input for datetime - in a real app, you might want a proper datetime picker */}
          <Input
            testID="create-event-datetime"
            value={formData.dateTime}
            onChangeText={(value) => handleChange('dateTime', value)}
            editable={!loading}
            placeholder="2026-08-27 19:30"
          />
        </Field>

        <Field label="Lieu" hint="Adresse ou nom du lieu">
          <Input
            testID="create-event-location"
            value={formData.location}
            onChangeText={(value) => handleChange('location', value)}
            editable={!loading}
            placeholder="Le Five Reims"
          />
        </Field>

        {venues.length > 0 && (
          <Field label="Complexe" hint="Facultatif. Laissez vide pour un lieu libre.">
            <Select
              testID="create-event-venue"
              value={formData.venueId}
              options={venues.map((venue) => ({
                value: venue.id,
                label: venue.city ? `${venue.name} — ${venue.city}` : venue.name,
              }))}
              onChange={(value) => handleChange('venueId', value)}
              placeholder="Aucun"
              disabled={loading}
            />
          </Field>
        )}

        <Field label="Nombre de places" hint="Au-delà, les joueurs passent en liste d'attente.">
          <Input
            testID="create-event-capacity"
            value={formData.capacity}
            onChangeText={(value) => handleChange('capacity', value)}
            editable={!loading}
            keyboardType="number-pad"
            placeholder="10"
          />
        </Field>

        <Field label="Prix indicatif (€)" hint="Le paiement en ligne arrive en V1.5.">
          <Input
            testID="create-event-price"
            value={formData.price}
            onChangeText={(value) => handleChange('price', value)}
            editable={!loading}
            keyboardType="decimal-pad"
            placeholder="0"
          />
        </Field>

        {groups.length > 0 && (
          <Field label="Groupe" hint="Une session de groupe n'est visible que de ses membres.">
            <Select
              testID="create-event-group"
              value={formData.groupId}
              options={groups.map((group) => ({
                value: group.id,
                label: group.name,
              }))}
              onChange={(value) => handleChange('groupId', value)}
              placeholder="Sans groupe"
              disabled={loading}
            />
          </Field>
        )}

        <Button
          testID="create-event-submit"
          onPress={handleSubmit}
          disabled={loading}
          full
        >
          {loading ? 'Création…' : 'Créer la session'}
        </Button>
      </View>
    </Screen>
  );
}