import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { buildSession, type SessionOptions } from '@/lib/program';
import { unlockedIds } from '@/lib/stats';
import type { CompletedSession, Consent, Feeling, Level, Profile, Session } from '@/lib/types';
import { defaultTrainingDays } from '@/lib/week';
import { appStorage } from '@/store/storage';

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
  trainingDays: [1, 3, 5],
  painZones: [],
  reminderEnabled: false,
  reminderHour: 18,
};

const FEELING_DELTA: Record<Feeling, number> = { facile: 0.1, bien: 0, dur: -0.1 };
/** Nombre de séances « trop facile » (ou « trop dur ») d'affilée avant de changer de niveau. */
const LEVEL_CHANGE_AFTER = 2;
const MAX_EVENTS = 500;

export interface AnalyticsEvent {
  name: string;
  at: string;
  props?: Record<string, string | number | boolean>;
}

export interface Feedback {
  at: string;
  message: string;
}

/** Résultat d'une séance enregistrée, affiché sur l'écran de fin. */
export interface SessionSummary {
  newAchievements: string[];
  durationSeconds: number;
}

export interface LevelChange {
  from: Level;
  to: Level;
}

interface AppState {
  profile: Profile | null;
  /** Pas encore de comptes : tout est stocké sur l'appareil en mode invité. */
  isGuest: boolean;
  /**
   * Phase de test : débloque les fonctionnalités normalement réservées aux comptes
   * (succès, historique complet). À passer à false quand les comptes seront actifs.
   */
  testMode: boolean;
  consent: Consent;
  /** Réponses « oui » au mini-questionnaire de sécurité. */
  safetyFlags: string[];
  /** Multiplicateur des répétitions et durées, ajusté par le ressenti après chaque séance. */
  intensity: number;
  easyStreak: number;
  hardStreak: number;
  voiceEnabled: boolean;
  todaySession: Session | null;
  history: CompletedSession[];
  installId: string;
  events: AnalyticsEvent[];
  feedback: Feedback[];

  completeOnboarding: (profile: Profile, consent: Consent, safetyFlags: string[]) => void;
  updateProfile: (profile: Profile) => void;
  regenerateSession: (options?: SessionOptions) => void;
  setTodaySession: (session: Session) => void;
  recordSession: (
    entry: Omit<CompletedSession, 'completedAt' | 'durationSeconds' | 'feeling'> & {
      startedAt: number;
    },
  ) => SessionSummary;
  rateLastSession: (feeling: Feeling) => LevelChange | null;
  setConsent: (consent: Partial<Consent>) => void;
  setVoiceEnabled: (enabled: boolean) => void;
  track: (name: string, props?: AnalyticsEvent['props']) => void;
  addFeedback: (message: string) => void;
  resetAll: () => void;
}

const initialState = {
  profile: null,
  isGuest: true,
  testMode: true,
  consent: { healthData: false, analytics: false, acceptedAt: null },
  safetyFlags: [],
  intensity: 1,
  easyStreak: 0,
  hardStreak: 0,
  voiceEnabled: true,
  todaySession: null,
  history: [],
  events: [],
  feedback: [],
};

function newInstallId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialState,
      installId: newInstallId(),

      completeOnboarding: (profile, consent, safetyFlags) => {
        set({
          profile,
          consent,
          safetyFlags,
          todaySession: buildSession(profile, { intensity: get().intensity }),
        });
        get().track('onboarding_completed', { goal: profile.goal, level: profile.level });
      },

      updateProfile: (profile) =>
        set({ profile, todaySession: buildSession(profile, { intensity: get().intensity }) }),

      regenerateSession: (options) => {
        const { profile, intensity } = get();
        if (!profile) return;
        set({ todaySession: buildSession(profile, { intensity, ...options }) });
      },

      setTodaySession: (session) => set({ todaySession: session }),

      recordSession: ({ startedAt, ...entry }) => {
        const { profile, history, intensity } = get();
        const ctx = { weeklyGoal: profile?.trainingDays.length ?? 3 };
        const before = new Set(unlockedIds(history, ctx));
        const now = Date.now();
        const durationSeconds = Math.round((now - startedAt) / 1000);
        const nextHistory = [
          { ...entry, completedAt: new Date(now).toISOString(), durationSeconds },
          ...history,
        ];
        set({
          history: nextHistory,
          todaySession: profile
            ? buildSession(profile, { intensity, seed: nextHistory.length })
            : null,
        });
        get().track('session_completed', { partial: Boolean(entry.partial), durationSeconds });
        return {
          newAchievements: unlockedIds(nextHistory, ctx).filter((id) => !before.has(id)),
          durationSeconds,
        };
      },

      rateLastSession: (feeling) => {
        const { profile, history, intensity, easyStreak, hardStreak } = get();
        if (history.length === 0) return null;
        const [last, ...rest] = history;
        let nextIntensity = Math.min(1.5, Math.max(0.6, intensity + FEELING_DELTA[feeling]));
        const nextEasy = feeling === 'facile' ? easyStreak + 1 : 0;
        const nextHard = feeling === 'dur' ? hardStreak + 1 : 0;

        // Montée ou descente de niveau : les séances suivantes utilisent d'autres variantes.
        let change: LevelChange | null = null;
        if (profile && nextEasy >= LEVEL_CHANGE_AFTER && profile.level < 3) {
          change = { from: profile.level, to: (profile.level + 1) as Level };
        } else if (profile && nextHard >= LEVEL_CHANGE_AFTER && profile.level > 1) {
          change = { from: profile.level, to: (profile.level - 1) as Level };
        }
        const nextProfile = profile && change ? { ...profile, level: change.to } : profile;
        if (change) nextIntensity = 1;

        set({
          history: [{ ...last, feeling }, ...rest],
          intensity: nextIntensity,
          easyStreak: change ? 0 : nextEasy,
          hardStreak: change ? 0 : nextHard,
          profile: nextProfile,
          todaySession: nextProfile
            ? buildSession(nextProfile, { intensity: nextIntensity, seed: history.length })
            : null,
        });
        get().track('session_rated', { feeling });
        return change;
      },

      setConsent: (consent) => set({ consent: { ...get().consent, ...consent } }),

      setVoiceEnabled: (enabled) => set({ voiceEnabled: enabled }),

      // Statistiques d'usage anonymes, gardées sur l'appareil tant qu'aucun service n'est branché.
      track: (name, props) => {
        const { consent, events } = get();
        if (!consent.analytics) return;
        const event: AnalyticsEvent = { name, at: new Date().toISOString(), props };
        set({ events: [...events, event].slice(-MAX_EVENTS) });
      },

      addFeedback: (message) => {
        set({ feedback: [...get().feedback, { at: new Date().toISOString(), message }] });
        get().track('feedback_sent');
      },

      resetAll: () => set({ ...initialState, installId: newInstallId() }),
    }),
    {
      name: 'aria-state',
      version: 1,
      storage: createJSONStorage(() => appStorage),
      partialize: (state) => ({
        profile: state.profile,
        isGuest: state.isGuest,
        testMode: state.testMode,
        consent: state.consent,
        safetyFlags: state.safetyFlags,
        intensity: state.intensity,
        easyStreak: state.easyStreak,
        hardStreak: state.hardStreak,
        voiceEnabled: state.voiceEnabled,
        todaySession: state.todaySession,
        history: state.history,
        installId: state.installId,
        events: state.events,
        feedback: state.feedback,
      }),
      // Version 0 : profil avec « daysPerWeek » et sans consentement enregistré.
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>;
        if (version === 0 && state.profile) {
          const { daysPerWeek, ...profile } = state.profile as Record<string, unknown>;
          state.profile = {
            ...profile,
            trainingDays: defaultTrainingDays(Number(daysPerWeek) || 3),
            reminderEnabled: false,
            reminderHour: 18,
          };
          state.consent = { healthData: true, analytics: false, acceptedAt: null };
        }
        return state as unknown as AppState;
      },
    },
  ),
);

const subscribeHydration = (callback: () => void) => useAppStore.persist.onFinishHydration(callback);
const getHydrated = () => useAppStore.persist.hasHydrated();

/** Vrai une fois les données stockées sur l'appareil chargées. */
export function useHasHydrated() {
  return useSyncExternalStore(subscribeHydration, getHydrated, getHydrated);
}
