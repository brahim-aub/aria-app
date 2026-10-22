import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
/** Clé publique (anon / publishable) : elle peut être dans l'app, la RLS protège les données. */
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Sans configuration, l'app reste en mode local (pas de comptes). */
export const supabaseEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = supabaseEnabled
  ? createClient(url, anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

// Le jeton n'est rafraîchi que lorsque l'app est au premier plan.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Messages d'erreur Supabase traduits pour l'écran de connexion. */
export function authErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou mot de passe incorrect.';
  if (/email not confirmed/i.test(msg)) return 'Confirme d’abord ton adresse : ouvre le lien reçu par e-mail.';
  if (/already registered|already exists/i.test(msg)) return 'Un compte existe déjà avec cet e-mail. Connecte-toi.';
  if (/password should be at least/i.test(msg)) return 'Le mot de passe doit faire au moins 8 caractères.';
  if (/rate limit|too many/i.test(msg)) return 'Trop de tentatives. Réessaie dans quelques minutes.';
  if (/network|fetch/i.test(msg)) return 'Pas de connexion internet.';
  return msg;
}
