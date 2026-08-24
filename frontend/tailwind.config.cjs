/** @type {import('tailwindcss').Config} */
// .cjs et non .js : package.json ne declare pas "type": "module", donc un
// fichier .js y est traite comme du CommonJS et `export default` echouerait.
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
