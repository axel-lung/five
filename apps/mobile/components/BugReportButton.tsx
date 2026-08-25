import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, KeyboardAvoidingView } from 'react-native';
import { usePathname } from 'expo-router';
import { api } from 'five-api-client';
import { Alert, Button, Field, Input, Select } from 'five-ui';

/**
 * Déclaration d'anomalie, depuis n'importe quel écran connecté.
 *
 * Le bouton est flottant et non rangé dans un menu : une anomalie se déclare
 * là où elle se produit. Ranger l'entrée dans le profil obligerait à quitter
 * l'écran fautif, donc à la décrire de mémoire — et beaucoup de testeurs
 * renonceraient en chemin.
 *
 * Le contexte technique (URL, navigateur, taille d'écran) est capturé sans
 * rien demander : c'est précisément ce qu'un testeur ne pense pas à fournir
 * et ce qui manque toujours pour reproduire.
 */
const KINDS = [
  { value: 'bug', label: 'Ça ne marche pas' },
  { value: 'display', label: "Problème d'affichage" },
  { value: 'suggestion', label: 'Suggestion' },
];

const SEVERITIES = [
  { value: 'blocking', label: 'Bloquant — impossible de continuer' },
  { value: 'major', label: 'Gênant — contournable' },
  { value: 'minor', label: 'Mineur — détail' },
];

export const BugReportButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('bug');
  const [severity, setSeverity] = useState('major');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // L'ecran fautif, lu sur le routeur : c'est le premier renseignement qui
  // manque a une declaration, et celui qu'un testeur ne pense jamais a donner.
  const contextUrl = usePathname();

  const start = () => {
    setError(null);
    setOpen(true);
  };

  // Masquer le message de confirmation après un délai
  useEffect(() => {
    if (!sent) return;
    const timer = setTimeout(() => setSent(false), 6000);
    return () => clearTimeout(timer);
  }, [sent]);

  const submit = async () => {
    setBusy(true);
    setError(null);

    try {
      await api.post('/bug-reports', {
        kind,
        severity,
        description,
        context: {
          url: contextUrl,
          platform: 'mobile', // Identifie que ça vient de l'app mobile
          // Nous pourrions ajouter plus de détails device si nécessaire
        },
      });

      setDescription('');
      setKind('bug');
      setSeverity('major');
      setOpen(false);
      setSent(true);
    } catch (err: any) {
      const data = err.response?.data;
      setError(data?.details?.[0] ?? data?.message ?? 'Envoi impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Bouton flottant pour ouvrir le formulaire */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={start}
          accessibilityLabel="Déclarer une anomalie"
        >
          <View style={styles.fab}>
            <Text style={styles.fabText}>🐞</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Message de confirmation */}
      {sent && (
        <View style={styles.toastContainer}>
          <Alert kind="success">Merci, l’anomalie est transmise à l’équipe.</Alert>
        </View>
      )}

      {/* Modal de déclaration d'anomalie */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={open}
        onRequestClose={() => setOpen(false)}
        style={styles.modalContainer}
      >
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={styles.modalBackground}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Déclarer une anomalie</Text>
              <Text style={styles.modalSubtitle}>
                Merci de nous aider à améliorer Five. L’écran et votre plateforme sont joints automatiquement.
              </Text>

              {error && (
                <View style={styles.errorContainer}>
                  <Alert kind="error">{error}</Alert>
                </View>
              )}

              <View style={styles.formContainer}>
                <Field label="Type">
                  <Select
                    value={kind}
                    options={KINDS.map(k => ({
                      value: k.value,
                      label: k.label,
                    }))}
                    onChange={setKind}
                    placeholder="Sélectionner un type"
                  />
                </Field>

                <Field label="Gravité">
                  <Select
                    value={severity}
                    options={SEVERITIES.map(s => ({
                      value: s.value,
                      label: s.label,
                    }))}
                    onChange={setSeverity}
                    placeholder="Sélectionner une gravité"
                  />
                </Field>

                <Field
                  label="Que s’est-il passé ?"
                  hint="Ce que vous avez fait, ce que vous attendiez, ce qui s’est produit."
                >
                  <Input
                    testID="bug-description"
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Décrivez le problème..."
                    multiline
                    // Un champ multiligne demarre a la hauteur d'une ligne et
                    // le texte s'y centre : sans ces deux reglages, on ecrit
                    // dans une fente d'une ligne.
                    style={{ minHeight: 80 }}
                    textAlignVertical="top"
                  />
                </Field>

                <Text style={styles.contextText}>Écran : {contextUrl}</Text>

                <View style={styles.buttonContainer}>
                  <Button
                    testID="bug-cancel"
                    onPress={() => setOpen(false)}
                    variant="secondary"
                  >
                    Annuler
                  </Button>
                  <Button testID="bug-submit" onPress={submit} disabled={busy}>
                    {busy ? 'Envoi…' : 'Envoyer'}
                  </Button>
                </View>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    right: 24,
    bottom: 24, // Sera ajusté pour être au-dessus de la barre d'onglets
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10b981', // vert-500
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fabText: {
    fontSize: 24,
    color: 'white',
  },
  toastContainer: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 80,
    alignItems: 'center',
  },
  modalContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
  },
  formContainer: {
    gap: 16,
    marginTop: 16,
  },
  errorContainer: {
    marginBottom: 16,
  },
  contextText: {
    fontSize: 12,
    color: '#9ca3af',
    marginVertical: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 24,
  },
});

export default BugReportButton;