// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Les Edge Functions tournent sous Deno, hors de l'app.
    ignores: ['dist/*', 'supabase/functions/*'],
  },
]);
