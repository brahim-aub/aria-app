import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { supabase, supabaseEnabled } from '@/lib/supabase';

import { hydrate, useApp } from './AppStore';
import type { AppData } from './types';

/** choice : compte vide alors que le téléphone a déjà des données, on demande quoi faire. */
export type SyncStatus = 'off' | 'pulling' | 'choice' | 'synced' | 'saving' | 'error';

type Auth = {
  /** false tant que la session enregistrée n'est pas relue. */
  ready: boolean;
  enabled: boolean;
  session: Session | null;
  email: string | null;
  sync: { status: SyncStatus; at?: string; error?: string };
  signIn: (email: string, password: string) => Promise<void>;
  /** Renvoie true si un e-mail de confirmation a été envoyé. */
  signUp: (email: string, password: string) => Promise<boolean>;
  resendConfirmation: (email: string) => Promise<void>;
  sendResetCode: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, password: string) => Promise<void>;
  /** Réponse au choix : garder les données du téléphone sur le nouveau compte, ou repartir de zéro. */
  resolveImport: (keepPhoneData: boolean) => void;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<Auth | null>(null);
const TABLE = 'user_data';
/** Après le clic sur le lien de confirmation : retour dans l'app (ou l'aperçu web en développement). */
const confirmRedirect = () => Linking.createURL('/connexion');

/** Drapeau « changements pas encore envoyés » pour ce compte, sur ce téléphone. */
const dirtyKey = (uid: string) => `aria-sport/dirty/${uid}`;

function client() {
  if (!supabase) throw new Error('Supabase n’est pas configuré.');
  return supabase;
}

/** La clé Gemini personnelle reste sur le téléphone, elle n'est jamais envoyée au cloud. */
function cloudCopy(d: AppData) {
  const { apiKey: _local, ...rest } = d;
  return rest;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabaseEnabled);
  const [sync, setSync] = useState<Auth['sync']>({ status: 'off' });
  const { ready: dataReady, data, mutate, resetAll } = useApp();
  const userId = session?.user.id ?? null;
  const lastSaved = useRef<string | null>(null);
  const pulledFor = useRef<string | null>(null);
  const inflight = useRef<string | null>(null);
  const hasLocalData = useRef(false);
  const dataRef = useRef(data);
  const statusRef = useRef<SyncStatus>('off');

  useEffect(() => {
    dataRef.current = data;
    hasLocalData.current = data.profile.onboarded || data.logs.length > 0;
  }, [data]);

  useEffect(() => {
    statusRef.current = sync.status;
  }, [sync.status]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth
      .getSession()
      .then(({ data: s }) => setSession(s.session))
      .finally(() => setReady(true));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  /** Envoie l'état actuel s'il diffère du dernier envoi réussi. */
  const pushNow = useCallback(async () => {
    const uid = pulledFor.current;
    if (!supabase || !uid || statusRef.current === 'pulling' || statusRef.current === 'choice') return;
    const payload = cloudCopy(dataRef.current);
    const json = JSON.stringify(payload);
    if (json === lastSaved.current || json === inflight.current) return;
    inflight.current = json;
    setSync((s) => ({ ...s, status: 'saving' }));
    const at = new Date().toISOString();
    const { error } = await client().from(TABLE).upsert({ user_id: uid, data: payload, updated_at: at });
    inflight.current = null;
    if (error) {
      setSync({ status: 'error', error: error.message });
      return;
    }
    lastSaved.current = json;
    // Ne lève le drapeau que si rien n'a changé pendant l'envoi.
    if (JSON.stringify(cloudCopy(dataRef.current)) === json) await AsyncStorage.removeItem(dirtyKey(uid)).catch(() => {});
    setSync({ status: 'synced', at });
  }, []);

  // À la connexion (et à chaque démarrage) :
  // - des changements locaux jamais envoyés (hors connexion, app fermée trop tôt) passent en priorité ;
  // - sinon les données du compte remplacent celles du téléphone ;
  // - un compte encore vide demande s'il faut y mettre celles du téléphone.
  useEffect(() => {
    if (!supabase || !userId || !dataReady || pulledFor.current === userId) return;
    pulledFor.current = userId;
    lastSaved.current = null;
    setSync({ status: 'pulling' });
    (async () => {
      try {
        const dirty = (await AsyncStorage.getItem(dirtyKey(userId)).catch(() => null)) === '1';
        const { data: row, error } = await client().from(TABLE).select('data, updated_at').eq('user_id', userId).maybeSingle();
        if (error) throw error;
        if (row?.data && !dirty) {
          const remote = hydrate(row.data as Partial<AppData>);
          lastSaved.current = JSON.stringify(cloudCopy(remote));
          mutate((d) => ({ ...remote, apiKey: d.apiKey }));
          setSync({ status: 'synced', at: row.updated_at as string });
        } else if (row?.data || !hasLocalData.current) {
          // Changements locaux en attente (ou compte vide sur un téléphone vierge) : on envoie.
          setSync({ status: 'saving' });
        } else {
          setSync({ status: 'choice' });
        }
      } catch (e) {
        pulledFor.current = null;
        setSync({ status: 'error', error: e instanceof Error ? e.message : String(e) });
      }
    })();
  }, [userId, dataReady, mutate]);

  // Chaque changement est marqué « à envoyer » tout de suite, puis envoyé 1,5 s plus tard.
  useEffect(() => {
    if (!supabase || !userId || pulledFor.current !== userId) return;
    if (sync.status === 'pulling' || sync.status === 'choice' || (sync.status === 'error' && lastSaved.current === null)) return;
    const json = JSON.stringify(cloudCopy(data));
    if (json === lastSaved.current || json === inflight.current) return;
    AsyncStorage.setItem(dirtyKey(userId), '1').catch(() => {});
    const t = setTimeout(pushNow, 1500);
    return () => clearTimeout(t);
  }, [data, userId, sync.status, pushNow]);

  // Envoi immédiat quand l'app passe en arrière-plan ; nouvel essai au retour si le dernier a échoué.
  useEffect(() => {
    if (!supabase || !userId) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive' || state === 'active') pushNow();
    });
    return () => sub.remove();
  }, [userId, pushNow]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await client().auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data: res, error } = await client().auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: confirmRedirect() } });
    if (error) throw error;
    // Supabase renvoie un utilisateur sans identités quand l'e-mail est déjà pris.
    if (res.user && res.user.identities?.length === 0) throw new Error('User already registered');
    return !res.session;
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    const { error } = await client().auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: confirmRedirect() } });
    if (error) throw error;
  }, []);

  const sendResetCode = useCallback(async (email: string) => {
    const { error } = await client().auth.resetPasswordForEmail(email.trim());
    if (error) throw error;
  }, []);

  const resetPassword = useCallback(async (email: string, code: string, password: string) => {
    const { error } = await client().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' });
    if (error) throw error;
    const { error: e2 } = await client().auth.updateUser({ password });
    if (e2) throw e2;
  }, []);

  const resolveImport = useCallback(
    (keepPhoneData: boolean) => {
      if (!keepPhoneData) resetAll();
      setSync({ status: 'saving' });
    },
    [resetAll],
  );

  const clearLocal = useCallback(() => {
    pulledFor.current = null;
    lastSaved.current = null;
    setSync({ status: 'off' });
    resetAll();
  }, [resetAll]);

  const signOut = useCallback(async () => {
    // Les données sont retirées du téléphone : on s'assure d'abord qu'elles sont sur le compte.
    await pushNow();
    if (JSON.stringify(cloudCopy(dataRef.current)) !== lastSaved.current && pulledFor.current) {
      throw new Error('Tes dernières modifications ne sont pas encore enregistrées sur ton compte. Vérifie ta connexion internet puis réessaie.');
    }
    await client().auth.signOut();
    // Les données du compte ne restent pas sur le téléphone après la déconnexion.
    clearLocal();
  }, [clearLocal, pushNow]);

  const deleteAccount = useCallback(async () => {
    const { error } = await client().rpc('delete_my_account');
    if (error) throw error;
    await client().auth.signOut();
    clearLocal();
  }, [clearLocal]);

  const value = useMemo<Auth>(
    () => ({
      ready,
      enabled: supabaseEnabled,
      session,
      email: session?.user.email ?? null,
      sync,
      signIn,
      signUp,
      resendConfirmation,
      sendResetCode,
      resetPassword,
      resolveImport,
      signOut,
      deleteAccount,
    }),
    [ready, session, sync, signIn, signUp, resendConfirmation, sendResetCode, resetPassword, resolveImport, signOut, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return ctx;
}
