import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { api, mediaSrc, setStoredUser, type Profile as ProfileType } from 'five-api-client';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Field,
  Input,
  Loading,
  PageTitle,
  Select,
} from 'five-ui';
import Screen from '../../../components/Screen';

/** C-03 : creneaux proposes. Etiquettes libres cote API, liste fermee ici. */
const SLOTS = [
  { value: 'lundi-soir', label: 'Lundi soir' },
  { value: 'mardi-soir', label: 'Mardi soir' },
  { value: 'mercredi-soir', label: 'Mercredi soir' },
  { value: 'jeudi-soir', label: 'Jeudi soir' },
  { value: 'vendredi-soir', label: 'Vendredi soir' },
  { value: 'samedi', label: 'Samedi' },
  { value: 'dimanche', label: 'Dimanche' },
];

const LEVELS = [
  { value: '', label: 'Non renseigné' },
  ...[1, 2, 3, 4, 5].map((level) => ({ value: String(level), label: String(level) })),
];

export default function Profile() {
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verifySent, setVerifySent] = useState<string | null>(null);

  useEffect(() => {
    api
      .get('/users/profile')
      .then((res) => setProfile(res.data))
      .catch((err) => setError(err.response?.data?.message ?? 'Chargement impossible'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (!profile) return <Alert kind="error">{error ?? 'Profil introuvable'}</Alert>;

  const set = (patch: Partial<ProfileType>) =>
    setProfile((prev) => (prev ? { ...prev, ...patch } : prev));

  const toggleSlot = (slot: string) => {
    const slots = profile.preferredSlots ?? [];
    set({
      preferredSlots: slots.includes(slot) ? slots.filter((s) => s !== slot) : [...slots, slot],
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      // Seuls les champs modifiables partent, et les chaines vides sont
      // retirees : Joi refuse '' la ou il attend un nom ou une ville.
      const payload: Record<string, unknown> = {
        preferredSlots: profile.preferredSlots ?? [],
        travelRadiusKm: profile.travelRadiusKm === null ? null : profile.travelRadiusKm,
      };

      for (const key of [
        'firstName',
        'lastName',
        'phone',
        'city',
        'bio',
        'preferredPosition',
      ] as const) {
        const value = profile[key];
        if (value) payload[key] = value;
      }
      if (profile.selfDeclaredLevel) payload.selfDeclaredLevel = profile.selfDeclaredLevel;

      const response = await api.put('/users/profile', payload);
      setProfile(response.data);
      await setStoredUser(response.data);
      setNotice('Profil enregistré.');
    } catch (err: any) {
      const data = err.response?.data;
      setError(data?.details?.[0] ?? data?.message ?? 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  const requestVerification = async () => {
    setError(null);
    try {
      const response = await api.post('/auth/verify-email');
      // Hors production, l'API renvoie le jeton pour permettre un test bout
      // en bout : on affiche alors le lien directement.
      setVerifySent(response.data.token ?? null);
      setNotice('Email de vérification envoyé.');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Envoi impossible');
    }
  };

  return (
    <Screen className="max-w-md self-center">
      <PageTitle subtitle={profile.email}>Mon profil</PageTitle>

      {notice ? (
        <View className="mb-4">
          <Alert kind="success">{notice}</Alert>
        </View>
      ) : null}
      {error ? (
        <View className="mb-4">
          <Alert kind="error">{error}</Alert>
        </View>
      ) : null}

      <Card className="mb-4">
        <View className="flex-row items-center gap-4">
          <Avatar uri={mediaSrc(profile.avatarUrl)} size={64} />
          {/* TODO Phase 2 : AvatarUpload, via expo-image-picker. */}
          <Text className="flex-1 text-sm text-gray-500">
            Le changement de photo arrive avec la prochaine version.
          </Text>
        </View>
      </Card>

      {/* C-05 : verification de l'adresse email. */}
      <Card className="mb-4">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="font-semibold text-gray-900">Adresse email</Text>
            <Text className="text-sm text-gray-600">
              {profile.emailVerified ? 'Vérifiée' : 'Non vérifiée'}
            </Text>
          </View>
          {!profile.emailVerified ? (
            <Button variant="secondary" onPress={requestVerification}>
              Vérifier
            </Button>
          ) : null}
        </View>

        {verifySent ? (
          <Text className="text-xs text-gray-500 mt-3">
            Mode développement — lien direct :{' '}
            <Link
              href={`/verifier-email/${verifySent}` as never}
              className="text-green-700 underline"
            >
              /verifier-email/{verifySent}
            </Link>
          </Text>
        ) : null}
      </Card>

      <View className="gap-4">
        <Field label="Prénom">
          <Input
            value={profile.firstName ?? ''}
            onChangeText={(value) => set({ firstName: value })}
            autoComplete="given-name"
          />
        </Field>

        <Field label="Nom">
          <Input
            value={profile.lastName ?? ''}
            onChangeText={(value) => set({ lastName: value })}
            autoComplete="family-name"
          />
        </Field>

        <Field label="Ville">
          <Input value={profile.city ?? ''} onChangeText={(value) => set({ city: value })} />
        </Field>

        <Field label="Poste préféré">
          <Input
            placeholder="Gardien, défenseur, attaquant…"
            value={profile.preferredPosition ?? ''}
            onChangeText={(value) => set({ preferredPosition: value })}
          />
        </Field>

        <Field label="Niveau auto-déclaré" hint="De 1 (débutant) à 5 (confirmé).">
          <Select
            options={LEVELS}
            value={profile.selfDeclaredLevel == null ? '' : String(profile.selfDeclaredLevel)}
            placeholder="Non renseigné"
            onChange={(value) => set({ selfDeclaredLevel: value ? Number(value) : null })}
          />
        </Field>

        {/* C-03 : disponibilites. */}
        <Field label="Créneaux préférés">
          <View className="flex-row flex-wrap gap-2">
            {SLOTS.map((slot) => {
              const active = (profile.preferredSlots ?? []).includes(slot.value);

              return (
                <Pressable
                  key={slot.value}
                  onPress={() => toggleSlot(slot.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  className={`min-h-[44px] px-3 rounded-lg border justify-center ${
                    active ? 'bg-green-50 border-green-500' : 'bg-white border-gray-300'
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      active ? 'text-green-800' : 'text-gray-700'
                    }`}
                  >
                    {slot.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label="Rayon de déplacement (km)">
          <Input
            keyboardType="number-pad"
            value={profile.travelRadiusKm == null ? '' : String(profile.travelRadiusKm)}
            onChangeText={(value) =>
              set({ travelRadiusKm: value === '' ? null : Number(value.replace(/\D/g, '')) })
            }
          />
        </Field>

        <Button onPress={save} disabled={saving} full>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </View>

      <View className="mt-8 pt-6 border-t border-gray-200 gap-3">
        <Link href="/profil/blocages" className="text-sm text-gray-600 underline">
          Joueurs bloqués
        </Link>
        <Link href="/profil/donnees" className="text-sm text-gray-600 underline">
          Mes données et mon compte
        </Link>
      </View>
    </Screen>
  );
}
