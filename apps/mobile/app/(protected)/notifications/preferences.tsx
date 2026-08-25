import React, { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { api } from 'five-api-client';
import { Alert, Button, Card, Field, Loading, PageTitle, Select } from 'five-ui';
import Screen from '../../../components/Screen';

/** N-04 : canaux et heures de silence. */
const HOURS = [
  { value: '', label: '—' },
  ...Array.from({ length: 24 }, (_, h) => ({
    value: String(h),
    label: `${String(h).padStart(2, '0')}:00`,
  })),
];

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api
      .get('/notifications/preferences')
      .then((res) => setPrefs(res.data))
      .catch((err) => setError(err.response?.data?.message ?? 'Chargement impossible'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (!prefs) return <Alert kind="error">{error ?? 'Préférences introuvables'}</Alert>;

  const set = (patch: Record<string, unknown>) => setPrefs((p: any) => ({ ...p, ...patch }));

  const save = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await api.put('/notifications/preferences', {
        pushEnabled: prefs.pushEnabled,
        emailEnabled: prefs.emailEnabled,
        // null est une valeur voulue — « pas d'heures de silence » — et se
        // distingue d'un champ absent, que l'API laisserait inchange.
        quietHoursStart: prefs.quietHoursStart,
        quietHoursEnd: prefs.quietHoursEnd,
      });
      setPrefs(response.data);
      setNotice('Préférences enregistrées.');
    } catch (err: any) {
      const data = err.response?.data;
      setError(data?.details?.[0] ?? data?.message ?? 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  const toggle = (label: string, key: 'pushEnabled' | 'emailEnabled') => (
    <View className="flex-row items-center justify-between gap-3 min-h-[44px]">
      <Text className="text-sm font-medium text-gray-800">{label}</Text>
      <Switch
        value={Boolean(prefs[key])}
        onValueChange={(value) => set({ [key]: value })}
        accessibilityLabel={label}
      />
    </View>
  );

  return (
    <Screen className="max-w-md self-center">
      <PageTitle subtitle="Ce que vous recevez, et quand.">Préférences</PageTitle>

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

      <View className="gap-4">
        <Card>
          {toggle('Notifications push', 'pushEnabled')}
          {toggle('Emails', 'emailEnabled')}
        </Card>

        <Card>
          <Text className="font-semibold text-gray-900 mb-1">Heures de silence</Text>
          <Text className="text-sm text-gray-600 mb-3">
            Aucune notification pendant cette plage. Laissez vide pour ne rien silencier.
          </Text>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field label="De">
                <Select
                  options={HOURS}
                  value={prefs.quietHoursStart == null ? '' : String(prefs.quietHoursStart)}
                  onChange={(value) =>
                    set({ quietHoursStart: value === '' ? null : Number(value) })
                  }
                />
              </Field>
            </View>

            <View className="flex-1">
              <Field label="À">
                <Select
                  options={HOURS}
                  value={prefs.quietHoursEnd == null ? '' : String(prefs.quietHoursEnd)}
                  onChange={(value) =>
                    set({ quietHoursEnd: value === '' ? null : Number(value) })
                  }
                />
              </Field>
            </View>
          </View>
        </Card>

        <Button onPress={save} disabled={saving} full>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </View>
    </Screen>
  );
}
