/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    '../../packages/ui/src/**/*.{js,jsx,ts,tsx}',
  ],
  // 'class' et non le defaut 'media' : react-native-css-interop observe
  // l'insertion de la feuille de style puis appelle colorScheme.set(), qui
  // leve une exception si darkMode vaut 'media'. L'application est en theme
  // clair uniquement et n'utilise aucune variante `dark:`, donc ce reglage ne
  // change rien a l'affichage — il supprime seulement l'exception.
  darkMode: 'class',
  presets: [require('nativewind/preset')],
  theme: {
    extend: {},
  },
  plugins: [],
};
