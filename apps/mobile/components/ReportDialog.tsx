import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { api } from 'five-api-client';
import { Alert, Button, Card, Field, Input, Select } from 'five-ui';

/**
 * S-05 : signalement d'un compte, d'un groupe ou d'une session.
 *
 * Les motifs sont une liste fermee : un champ libre seul produit des
 * signalements inexploitables par la moderation, et le detail reste possible
 * a cote.
 *
 * A ne pas confondre avec le signalement d'anomalie (BugReportButton), qui
 * remonte un dysfonctionnement du produit et non le comportement de
 * quelqu'un.
 */
const REASONS = [
  { value: 'spam', label: 'Spam ou publicité' },
  { value: 'harcelement', label: 'Harcèlement ou insultes' },
  { value: 'contenu-inapproprie', label: 'Contenu inapproprié' },
  { value: 'faux-profil', label: 'Faux profil' },
  { value: 'autre', label: 'Autre' },
];

type Props = {
  targetType: 'user' | 'group' | 'event';
  targetId: string;
  label?: string;
};

export const ReportDialog: React.FC<Props> = ({ targetType, targetId, label = 'Signaler' }) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0].value);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);

    try {
      await api.post('/reports', {
        targetType,
        targetId,
        reason,
        ...(details ? { details } : {}),
      });
      setDone(true);
      setOpen(false);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Signalement impossible');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return <Alert kind="success">Signalement transmis à la modération.</Alert>;
  }

  if (!open) {
    return (
      <Button variant="secondary" onPress={() => setOpen(true)} testID="report-open" full>
        {label}
      </Button>
    );
  }

  return (
    <Card>
      <Text className="font-semibold text-gray-900 mb-3">Signaler</Text>

      {error ? (
        <View className="mb-3">
          <Alert kind="error">{error}</Alert>
        </View>
      ) : null}

      <View className="gap-3">
        <Field label="Motif">
          <Select value={reason} options={REASONS} onChange={setReason} testID="report-reason" />
        </Field>

        <Field label="Précisions" hint="Facultatif.">
          <Input
            value={details}
            onChangeText={setDetails}
            multiline
            numberOfLines={3}
            testID="report-details"
          />
        </Field>

        <Button variant="danger" onPress={submit} disabled={busy} testID="report-submit" full>
          {busy ? '…' : 'Envoyer'}
        </Button>
        <Button variant="secondary" onPress={() => setOpen(false)} full>
          Annuler
        </Button>
      </View>
    </Card>
  );
};

export default ReportDialog;
