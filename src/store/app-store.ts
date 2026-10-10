import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { buildSession, type SessionOptions } from '@/lib/program';
import type { CompletedSession, Feeling, Profile, Session } from '@/lib/types';

/** Profil utilisé par le bouton de test qui saute l'onboarding. */
export const TEST_PROFILE: Profile = {
  firstName: 'Testeur',
  age: 30,
  sex: 'homme',
  heightCm: 178,
  weightKg: 75,
  goal: 'forme',
  level: 1,
  equipment: [],
  minutesPerSession: 20,
  daysPerWeek: 3,
  painZones: [],
};

const FEELING_DELTA: Record<Feeling, number> = { facile: 0.1, bien: 0, dur: -0.1 };

interface AppState {
  hasHydrated: boolean;
  profile: Profile | null;
  /** Pas encore de comptes : tout est stocké sur le téléphone en mode invité. */
  isGuest: boolean;
  /**
   * Phase de test : débloque les fonctionnalités normalement réservées aux comptes
   * (succès, historique complet). À passer à false quand les comptes seront actifs.
   */
  testMode: boolean;
  /** Multiplicateur des répétitions et durées, ajusté par le ressenti après chaque séance. */
  intensity: number;
  todaySession: Session | null;
  history: CompletedSession[];

  completeOnboarding: (profile: Profile) => void;
  regenerateSession: (options?: SessionOptions) => void;
  recordSession: (
    entry: Omit<CompletedSession, 'completedAt' | 'durationSeconds'> & { startedAt: number },
  ) => void;
  resetAll: () => void;
}

const initialState = {
  profile: null,
  isGuest: true,
  testMode: true,
  intensity: 1,
  todaySession: null,
  history: [],
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialState,
      hasHydrated: false,

      completeOnboarding: (profile) =>
        set({ profile, todaySession: buildSession(profile, { intensity: get().intensity }) }),

      regenerateSession: (options) => {
        const { profile, intensity } = get();
        if (!profile) return;
        set({ todaySession: buildSession(profile, { intensity, ...options }) });
      },

      recordSession: ({ startedAt, ...entry }) => {
        const { profile, history, intensity } = get();
        const now = Date.now();
        const nextIntensity = Math.min(1.5, Math.max(0.6, intensity + FEELING_DELTA[entry.feeling]));
        set({
          history: [
            {
              ...entry,
              completedAt: new Date(now).toISOString(),
              durationSeconds: Math.round((now - startedAt) / 1000),
            },
            ...history,
          ],
          intensity: nextIntensity,
          todaySession: profile
            ? buildSession(profile, { intensity: nextIntensity, seed: history.length + 1 })
            : null,
        });
      },

      resetAll: () => set({ ...initialState }),
    }),
    {
      name: 'aria-state',
      storage: createJSONStorage(() => Storage),
      partialize: ({ profile, isGuest, testMode, intensity, todaySession, history }) => ({
        profile,
        isGuest,
        testMode,
        intensity,
        todaySession,
        history,
      }),
      onRehydrateStorage: () => () => useAppStore.setState({ hasHydrated: true }),
    },
  ),
);
