import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';

/**
 * Briques d'interface partagees.
 *
 * Mobile d'abord : les cibles tactiles font au moins 44 px de haut, les champs
 * 16 px de police — en dessous, Safari iOS zoome automatiquement a la mise au
 * point et casse la mise en page.
 *
 * Contrairement au web, une couleur de texte posee sur un conteneur ne descend
 * pas jusqu'aux enfants : chaque variante porte donc ses classes de fond et de
 * texte separement.
 */

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <View className={`bg-white border border-gray-200 rounded-xl p-4 sm:p-5 ${className}`}>
    {children}
  </View>
);

export const PageTitle: React.FC<{ children: React.ReactNode; subtitle?: string }> = ({
  children,
  subtitle,
}) => (
  <View className="mb-5">
    <Text className="text-2xl sm:text-3xl font-bold text-gray-900">{children}</Text>
    {subtitle ? <Text className="text-gray-600 mt-1">{subtitle}</Text> : null}
  </View>
);

const alertTones = {
  error: { box: 'bg-red-50 border-red-200', text: 'text-red-700' },
  success: { box: 'bg-green-50 border-green-200', text: 'text-green-700' },
  info: { box: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
};

export const Alert: React.FC<{
  kind?: keyof typeof alertTones;
  children: React.ReactNode;
}> = ({ kind = 'info', children }) => {
  const tone = alertTones[kind];

  return (
    <View accessibilityRole="alert" className={`border rounded-lg px-4 py-3 ${tone.box}`}>
      <Text className={`text-sm ${tone.text}`}>{children}</Text>
    </View>
  );
};

const buttonTones = {
  primary: { box: 'bg-green-600 active:bg-green-700', text: 'text-white' },
  secondary: { box: 'bg-white active:bg-gray-50 border border-gray-300', text: 'text-gray-800' },
  danger: { box: 'bg-red-600 active:bg-red-700', text: 'text-white' },
};

type ButtonProps = {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: keyof typeof buttonTones;
  full?: boolean;
  disabled?: boolean;
  testID?: string;
  className?: string;
};

export const Button: React.FC<ButtonProps> = ({
  children,
  onPress,
  variant = 'primary',
  full = false,
  disabled = false,
  testID,
  className = '',
}) => {
  const tone = buttonTones[variant];

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={`min-h-[44px] px-5 rounded-lg items-center justify-center
        ${tone.box} ${disabled ? 'opacity-50' : ''} ${full ? 'w-full' : ''} ${className}`}
    >
      {typeof children === 'string' ? (
        <Text className={`font-semibold ${tone.text}`}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
};

export const Field: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, hint, children }) => (
  <View>
    <Text className="text-sm font-medium text-gray-700 mb-1">{label}</Text>
    {children}
    {hint ? <Text className="text-xs text-gray-500 mt-1">{hint}</Text> : null}
  </View>
);

/** text-base et non text-sm : en dessous de 16 px, iOS zoome a la saisie. */
export const inputClass =
  'w-full min-h-[44px] px-3 py-2 text-base text-gray-900 border border-gray-300 rounded-lg';

export const Input: React.FC<TextInputProps & { className?: string }> = ({
  className = '',
  ...props
}) => (
  <TextInput
    placeholderTextColor="#9ca3af"
    {...props}
    className={`${inputClass} ${className}`}
  />
);

/**
 * Liste deroulante.
 *
 * React Native n'a pas d'equivalent de `<select>`, et les implementations
 * natives divergent trop (roue sur iOS, boite de dialogue sur Android) pour
 * qu'un composant systeme donne le meme rendu partout. Une feuille modale
 * fait le travail sur les trois cibles, avec les memes cibles tactiles de
 * 44 px que le reste des formulaires.
 */
export type SelectOption = { value: string; label: string };

export const Select: React.FC<{
  value?: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  testID?: string;
}> = ({ value, options, onChange, placeholder = '—', disabled = false, testID }) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <>
      <Pressable
        testID={testID}
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded: open }}
        className={`${inputClass} justify-center ${disabled ? 'opacity-50' : ''}`}
      >
        <Text className={`text-base ${selected ? 'text-gray-900' : 'text-gray-400'}`}>
          {selected ? selected.label : placeholder}
        </Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        // Sur Android, le bouton retour doit fermer la feuille plutot que
        // l'ecran qui se trouve derriere.
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/40 justify-end sm:justify-center sm:items-center"
          onPress={() => setOpen(false)}
        >
          {/* Pressable et non View : sans lui, un appui dans la liste
              traverserait jusqu'au fond et refermerait la feuille. */}
          <Pressable
            onPress={() => undefined}
            className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl py-2"
            style={{ maxHeight: '70%' }}
          >
            <ScrollView>
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: option.value === value }}
                  className="min-h-[44px] px-5 justify-center active:bg-gray-50"
                >
                  <Text
                    className={`text-base ${
                      option.value === value ? 'text-green-700 font-semibold' : 'text-gray-800'
                    }`}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

/** Case a cocher : `<input type="checkbox">` n'existe pas non plus. */
export const Checkbox: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  testID?: string;
}> = ({ checked, onChange, label, disabled = false, testID }) => (
  <Pressable
    testID={testID}
    onPress={() => onChange(!checked)}
    disabled={disabled}
    accessibilityRole="checkbox"
    accessibilityState={{ checked, disabled }}
    className={`flex-row items-start gap-3 min-h-[44px] py-1 ${disabled ? 'opacity-50' : ''}`}
  >
    <View
      className={`w-5 h-5 mt-0.5 rounded border items-center justify-center ${
        checked ? 'bg-green-600 border-green-600' : 'bg-white border-gray-400'
      }`}
    >
      {checked ? <Text className="text-white text-xs font-bold">✓</Text> : null}
    </View>
    <Text className="flex-1 text-sm text-gray-700">{label}</Text>
  </Pressable>
);

/** Photo de profil ou logo de groupe, avec sa silhouette de repli. */
export const Avatar: React.FC<{
  uri?: string | null;
  size?: number;
  square?: boolean;
}> = ({ uri, size = 40, square = false }) => {
  const shape = square ? 'rounded-xl' : 'rounded-full';

  if (uri) {
    return (
      <Image
        source={{ uri }}
        accessibilityIgnoresInvertColors
        style={{ width: size, height: size }}
        className={`${shape} border border-gray-200`}
      />
    );
  }

  return (
    <View
      style={{ width: size, height: size }}
      className={`${shape} bg-gray-200 items-center justify-center`}
    >
      <Text style={{ fontSize: size * 0.45 }}>👤</Text>
    </View>
  );
};

export const Loading: React.FC<{ label?: string }> = ({ label = 'Chargement…' }) => (
  <View className="flex-row items-center justify-center py-12 gap-2">
    <ActivityIndicator />
    <Text className="text-gray-500">{label}</Text>
  </View>
);

/** Etat d'un evenement, lisible d'un coup d'oeil. */
const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  open: 'Ouvert',
  full: 'Complet',
  completed: 'Terminé',
  cancelled: 'Annulé',
};

const statusTones: Record<string, { box: string; text: string }> = {
  draft: { box: 'bg-gray-100', text: 'text-gray-700' },
  open: { box: 'bg-green-100', text: 'text-green-800' },
  full: { box: 'bg-orange-100', text: 'text-orange-800' },
  completed: { box: 'bg-gray-100', text: 'text-gray-700' },
  cancelled: { box: 'bg-red-100', text: 'text-red-800' },
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const tone = statusTones[status] ?? statusTones.draft;

  return (
    <View className={`px-2.5 py-1 rounded-full self-start ${tone.box}`}>
      <Text className={`text-xs font-semibold ${tone.text}`}>
        {statusLabels[status] ?? status}
      </Text>
    </View>
  );
};
