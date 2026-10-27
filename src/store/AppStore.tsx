import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { ACHIEVEMENTS, progressOf } from '@/data/achievements';
import { generateTemplates } from '@/data/generator';
import { addDays, dateKey } from '@/lib/date';
import { AiAuth, costOf, setUsageListener } from '@/lib/gemini';
import { searchPrices, storeTotals } from '@/lib/prices';
import { getDay } from '@/lib/schedule';
import { createLocalSaver } from '@/lib/localSave';
import { decodeLocalObject, readLocalSnapshot, type LocalLoadResult } from '@/lib/localLoad';
import { getCoachUndoPatch } from '@/lib/coachUndo';
import { computeStats } from '@/lib/stats';
import { newId } from '@/lib/workout';

import type { AppData, ChatMessage, Limitation, LogEntry, MealPlan, NutritionPrefs, Profile, Reminders, UndoSnapshot, WorkoutSession } from './types';

export type * from './types';

const STORAGE_KEY = 'aria-sport/v2';
const LEGACY_KEY = 'aria-sport/v1';

export const DEFAULT_PROFILE: Profile = {
  onboarded: false,
  name: '',
  sex: 'homme',
  age: 30,
  heightCm: 175,
  weightKg: 75,
  goal: 'forme',
  level: 'debutant',
  history: 'jamais',
  place: 'maison',
  equipment: [],
  sessionsPerWeek: 3,
  sessionMinutes: 25,
  trainingDays: [0, 2, 4],
  job: 'assis',
  wantsNutrition: true,
};

export const DEFAULT_DATA: AppData = {
  version: 2,
  profile: DEFAULT_PROFILE,
  plan: { startDate: dateKey(), templates: [] },
  overrides: {},
  limitations: [],
  customSessions: [],
  logs: [],
  weights: [],
  reminders: { enabled: false, days: [2, 4, 6], hour: 18, minute: 30 },
  chat: [],
  nutrition: {
    prefsSet: false,
    prefs: { diet: 'omnivore', likes: '', dislikes: '', allergies: '', mealsPerDay: 3, cookingTime: 'moyen', budget: 'moyen' },
  },
  achievements: {},
  counters: { chatMessages: 0, aiAdaptations: 0, customCreated: 0, mealPlans: 0 },
  apiKey: '',
};

export function snapshot(d: AppData): UndoSnapshot {
  return { profile: d.profile, plan: d.plan, overrides: d.overrides, limitations: d.limitations, nutrition: d.nutrition, customSessions: d.customSessions };
}

/** Déplace la séance du jour `from` vers `to`. Si `to` a déjà une séance, elle glisse au prochain jour libre. */
export function moveSessionIn(d: AppData, from: string, to: string, reason?: string): AppData {
  const src = getDay(d, from);
  if (!src.session) return d;
  const overrides = { ...d.overrides };
  const dest = getDay(d, to);
  if (dest.session && dest.status !== 'done' && dest.status !== 'skipped') {
    for (let i = 1; i <= 14; i++) {
      const k = addDays(to, i);
      const free = getDay({ ...d, overrides }, k);
      if (!free.session || free.status === 'skipped') {
        overrides[k] = { kind: 'replace', session: dest.session, reason: `Décalée depuis le ${to}` };
        break;
      }
    }
  }
  overrides[to] = { kind: 'replace', session: src.session, reason: reason ?? 'Séance décalée' };
  overrides[from] = { kind: 'skip', reason: reason ?? 'Séance décalée', movedTo: to };
  return { ...d, overrides };
}

type Store = {
  ready: boolean;
  localLoadFailed: boolean;
  retryingLocalLoad: boolean;
  retryLocalLoad: () => Promise<void>;
  localSaveFailed: boolean;
  retryingLocalSave: boolean;
  retryLocalSave: () => Promise<void>;
  data: AppData;
  apiKey: string;
  /** Comment appeler Gemini (relais du compte, clé personnelle ou intégrée, modèle). */
  ai: AiAuth;
  setAiTier: (tier: 'eco' | 'quality') => void;
  setHealthConsent: (ok: boolean) => void;
  /** Mise à jour libre de l'état (utilisée par le coach). */
  mutate: (fn: (d: AppData) => AppData) => void;
  completeOnboarding: (p: Profile, limitations: Omit<Limitation, 'id'>[]) => void;
  updateProfile: (patch: Partial<Profile>, regenerate?: boolean) => void;
  regeneratePlan: () => void;
  replaceDay: (date: string, session: WorkoutSession, reason?: string) => void;
  skipDay: (date: string, reason?: string) => void;
  restoreDay: (date: string) => void;
  moveDay: (from: string, to: string) => void;
  addLimitation: (l: Omit<Limitation, 'id'>) => void;
  removeLimitation: (id: string) => void;
  saveCustomSession: (s: WorkoutSession) => void;
  deleteCustomSession: (id: string) => void;
  addLog: (entry: Omit<LogEntry, 'id' | 'date'> & { date?: string }) => void;
  deleteLog: (id: string) => void;
  addWeight: (kg: number) => void;
  deleteWeight: (id: string) => void;
  setReminders: (r: Reminders) => void;
  setApiKey: (k: string) => void;
  addMessage: (m: Omit<ChatMessage, 'id' | 'date'>) => string;
  patchMessage: (id: string, patch: Partial<ChatMessage>) => void;
  clearChat: () => void;
  undoMessage: (id: string) => void;
  setNutritionPrefs: (p: NutritionPrefs) => void;
  setMealPlan: (p: MealPlan | undefined) => void;
  resetAll: () => void;
  /** Recherche des prix en cours (null sinon). */
  priceSearch: { stores: string[]; done: string[] } | null;
  /** Cherche les prix réels du plan de repas dans les magasins choisis. */
  findPrices: (stores?: string[]) => Promise<void>;
  selectStore: (store: string) => void;
  /** Succès débloqués à célébrer. */
  unlocked: string[];
  dismissUnlocked: () => void;
};

const AppContext = createContext<Store | null>(null);

/** Clé personnelle (réglages) d'abord ; sinon relais du compte, ou clé intégrée en mode local. */
function aiAuth(d: AppData): AiAuth {
  const personal = d.apiKey.trim();
  return { apiKey: personal || process.env.EXPO_PUBLIC_GEMINI_API_KEY || '', personalKey: !!personal, tier: d.aiTier ?? 'eco' };
}

/** Complète des données enregistrées (téléphone ou cloud) avec les valeurs par défaut. */
export function hydrate(saved: Partial<AppData> & { foodCache?: unknown }): AppData {
  // foodCache : cache de l'ancienne intégration Open Food Facts, plus utilisé.
  const { foodCache: _unused, ...parsed } = saved;
  return {
    ...DEFAULT_DATA,
    ...parsed,
    // Un message encore « en cours » vient d'une app fermée pendant la génération : il n'aboutira jamais.
    chat: (parsed.chat ?? []).map((m) => (m.pending ? { ...m, pending: false, error: true, text: `${m.text}

(Interrompu : l’app a été fermée avant la fin. Redemande-le au coach.)` } : m)),
    profile: { ...DEFAULT_PROFILE, ...parsed.profile },
    nutrition: { ...DEFAULT_DATA.nutrition, ...parsed.nutrition },
    counters: { ...DEFAULT_DATA.counters, ...parsed.counters },
  };
}

async function load(): Promise<AppData | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw !== null) return hydrate(decodeLocalObject(raw));
  // Reprise des données de la première version de l'app.
  const legacy = await AsyncStorage.getItem(LEGACY_KEY);
  if (legacy !== null) {
    const old = decodeLocalObject(legacy) as { name?: string; logs?: AppData['logs']; weights?: AppData['weights']; reminders?: AppData['reminders'] };
    return {
      ...DEFAULT_DATA,
      profile: { ...DEFAULT_PROFILE, name: old.name ?? '' },
      logs: old.logs ?? [],
      weights: old.weights ?? [],
      reminders: old.reminders ?? DEFAULT_DATA.reminders,
    };
  }
  return null;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(DEFAULT_DATA);
  const [ready, setReady] = useState(false);
  const [localLoadFailed, setLocalLoadFailed] = useState(false);
  const [retryingLocalLoad, setRetryingLocalLoad] = useState(true);
  const [localSaveFailed, setLocalSaveFailed] = useState(false);
  const [retryingLocalSave, setRetryingLocalSave] = useState(false);
  const [saveLocal] = useState(() => createLocalSaver(
    (payload) => AsyncStorage.setItem(STORAGE_KEY, payload), setLocalSaveFailed,
  ));
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const firstCheck = useRef(true);
  const localLoadAttempt = useRef(0);
  const [priceSearch, setPriceSearch] = useState<{ stores: string[]; done: string[] } | null>(null);
  const dataRef = useRef(data);
  const searching = useRef(false);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Consommation IA du mois (tokens réels renvoyés par Gemini, coût estimé au tarif de référence).
  useEffect(() => {
    setUsageListener((u) => {
      const month = new Date().toISOString().slice(0, 7);
      setData((d) => {
        const cur = d.aiUsage?.month === month ? d.aiUsage : { month, kinds: {} };
        const k = cur.kinds[u.kind] ?? { calls: 0, tokensIn: 0, tokensCached: 0, tokensOut: 0, searches: 0, costUsd: 0 };
        const next = {
          calls: k.calls + 1,
          tokensIn: k.tokensIn + u.tokensIn,
          tokensCached: k.tokensCached + u.tokensCached,
          tokensOut: k.tokensOut + u.tokensOut,
          searches: k.searches + u.searchQueries,
          usageVersion: 2 as const,
          legacyEstimate: k.legacyEstimate || (k.calls > 0 && k.usageVersion !== 2),
          costUsd: k.costUsd + costOf(u),
        };
        return { ...d, aiUsage: { month, kinds: { ...cur.kinds, [u.kind]: next } } };
      });
    });
    return () => setUsageListener(undefined);
  }, []);

  const finishLocalLoad = useCallback((result: LocalLoadResult<AppData>) => {
    if (result.ready) {
      if (result.data) setData(result.data);
      setLocalLoadFailed(false);
      setReady(true);
    } else setLocalLoadFailed(true);
    setRetryingLocalLoad(false);
  }, []);

  useEffect(() => {
    let active = true;
    const attempt = ++localLoadAttempt.current;
    void readLocalSnapshot(load).then((result) => {
      if (active && attempt === localLoadAttempt.current) finishLocalLoad(result);
    });
    return () => { active = false; };
  }, [finishLocalLoad]);

  const retryLocalLoad = useCallback(async () => {
    if (ready || retryingLocalLoad) return;
    setRetryingLocalLoad(true);
    const attempt = ++localLoadAttempt.current;
    const result = await readLocalSnapshot(load);
    if (attempt === localLoadAttempt.current) finishLocalLoad(result);
  }, [ready, retryingLocalLoad, finishLocalLoad]);

  useEffect(() => {
    if (ready) void saveLocal(JSON.stringify(data));
  }, [data, ready, saveLocal]);

  const retryLocalSave = useCallback(async () => {
    if (!ready) return;
    setRetryingLocalSave(true);
    try {
      await saveLocal(JSON.stringify(dataRef.current));
    } finally {
      setRetryingLocalSave(false);
    }
  }, [ready, saveLocal]);

  // Détection des succès débloqués.
  useEffect(() => {
    if (!ready || !data.profile.onboarded) return;
    const stats = computeStats(data);
    const fresh = ACHIEVEMENTS.filter((a) => !data.achievements[a.id] && progressOf(a, stats).done).map((a) => a.id);
    if (!fresh.length) {
      firstCheck.current = false;
      return;
    }
    const now = new Date().toISOString();
    // Les succès dépendent de tout l'état : on les recalcule après chaque changement.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData((d) => ({ ...d, achievements: { ...d.achievements, ...Object.fromEntries(fresh.map((id) => [id, now])) } }));
    // Au tout premier calcul (données reprises d'une ancienne version), on débloque sans fanfare.
    if (!firstCheck.current) setUnlocked((u) => [...u, ...fresh]);
    firstCheck.current = false;
  }, [data, ready]);

  const mutate = useCallback((fn: (d: AppData) => AppData) => setData(fn), []);

  const completeOnboarding: Store['completeOnboarding'] = useCallback((p, limitations) => {
    const profile = { ...p, onboarded: true };
    setData((d) => ({
      ...d,
      profile,
      plan: { startDate: dateKey(), templates: generateTemplates(profile) },
      overrides: {},
      limitations: limitations.map((l) => ({ ...l, id: newId() })),
      nutrition: d.nutrition,
      weights: d.weights.length ? d.weights : [{ id: newId(), date: new Date().toISOString(), kg: p.weightKg }],
    }));
  }, []);

  const updateProfile: Store['updateProfile'] = useCallback((patch, regenerate = false) => {
    setData((d) => {
      const profile = { ...d.profile, ...patch };
      if (!regenerate) return { ...d, profile };
      return { ...d, profile, plan: { startDate: dateKey(), templates: generateTemplates(profile) }, overrides: keepPast(d.overrides) };
    });
  }, []);

  const regeneratePlan = useCallback(() => {
    setData((d) => ({ ...d, plan: { startDate: dateKey(), templates: generateTemplates(d.profile) }, overrides: keepPast(d.overrides) }));
  }, []);

  const replaceDay: Store['replaceDay'] = useCallback((date, session, reason) => {
    setData((d) => ({ ...d, overrides: { ...d.overrides, [date]: { kind: 'replace', session, reason } } }));
  }, []);

  const skipDay: Store['skipDay'] = useCallback((date, reason) => {
    setData((d) => ({ ...d, overrides: { ...d.overrides, [date]: { kind: 'skip', reason } } }));
  }, []);

  const restoreDay = useCallback((date: string) => {
    setData((d) => {
      const overrides = { ...d.overrides };
      delete overrides[date];
      return { ...d, overrides };
    });
  }, []);

  const moveDay = useCallback((from: string, to: string) => setData((d) => moveSessionIn(d, from, to)), []);

  const addLimitation: Store['addLimitation'] = useCallback((l) => {
    setData((d) => ({ ...d, limitations: [...d.limitations, { ...l, id: newId() }] }));
  }, []);

  const removeLimitation = useCallback((id: string) => {
    setData((d) => ({ ...d, limitations: d.limitations.filter((l) => l.id !== id) }));
  }, []);

  const saveCustomSession = useCallback((s: WorkoutSession) => {
    setData((d) => {
      const exists = d.customSessions.some((c) => c.id === s.id);
      return {
        ...d,
        customSessions: exists ? d.customSessions.map((c) => (c.id === s.id ? s : c)) : [s, ...d.customSessions],
        counters: exists ? d.counters : { ...d.counters, customCreated: d.counters.customCreated + 1 },
      };
    });
  }, []);

  const deleteCustomSession = useCallback((id: string) => {
    setData((d) => ({ ...d, customSessions: d.customSessions.filter((c) => c.id !== id) }));
  }, []);

  const addLog: Store['addLog'] = useCallback((entry) => {
    const log: LogEntry = { ...entry, id: newId(), date: entry.date ?? new Date().toISOString() };
    setData((d) => ({ ...d, logs: [log, ...d.logs].sort((a, b) => b.date.localeCompare(a.date)) }));
  }, []);

  const deleteLog = useCallback((id: string) => {
    setData((d) => ({ ...d, logs: d.logs.filter((l) => l.id !== id) }));
  }, []);

  const addWeight = useCallback((kg: number) => {
    setData((d) => ({
      ...d,
      weights: [...d.weights, { id: newId(), date: new Date().toISOString(), kg }],
      profile: { ...d.profile, weightKg: kg },
    }));
  }, []);

  const deleteWeight = useCallback((id: string) => {
    setData((d) => ({ ...d, weights: d.weights.filter((w) => w.id !== id) }));
  }, []);

  const setReminders = useCallback((reminders: Reminders) => setData((d) => ({ ...d, reminders })), []);
  const setApiKey = useCallback((apiKey: string) => setData((d) => ({ ...d, apiKey })), []);

  const addMessage: Store['addMessage'] = useCallback((m) => {
    const id = newId();
    setData((d) => ({
      ...d,
      chat: [...d.chat, { ...m, id, date: new Date().toISOString() }].slice(-200),
      counters: m.role === 'user' ? { ...d.counters, chatMessages: d.counters.chatMessages + 1 } : d.counters,
    }));
    return id;
  }, []);

  const patchMessage: Store['patchMessage'] = useCallback((id, patch) => {
    setData((d) => ({ ...d, chat: d.chat.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  }, []);

  const clearChat = useCallback(() => setData((d) => ({ ...d, chat: [] })), []);

  const undoMessage = useCallback((id: string) => {
    setData((d) => {
      const msg = d.chat.find((m) => m.id === id);
      if (!msg?.undo) return d;
      const patch = getCoachUndoPatch(d, msg);
      if (!patch) return d;
      return {
        ...d,
        ...patch,
        chat: d.chat.map((m) => (m.id === id ? { ...m, undo: undefined, undoAfter: undefined, changes: [...(m.changes ?? []), '↩︎ Modifications annulées'] } : m)),
      };
    });
  }, []);

  const setNutritionPrefs = useCallback((prefs: NutritionPrefs) => {
    setData((d) => ({ ...d, nutrition: { ...d.nutrition, prefs, prefsSet: true } }));
  }, []);

  const setMealPlan = useCallback((plan: MealPlan | undefined) => {
    setData((d) => ({
      ...d,
      nutrition: { ...d.nutrition, plan },
      counters: plan ? { ...d.counters, mealPlans: d.counters.mealPlans + 1 } : d.counters,
    }));
  }, []);

  const resetAll = useCallback(() => {
    firstCheck.current = true;
    setData({ ...DEFAULT_DATA, plan: { startDate: dateKey(), templates: [] } });
  }, []);

  const findPrices = useCallback(async (storesArg?: string[]) => {
    const d0 = dataRef.current;
    const plan = d0.nutrition.plan;
    const stores = storesArg?.length ? storesArg : (d0.nutrition.prefs.stores ?? []);
    if (!plan) throw new Error('Crée d’abord un plan de repas.');
    if (!stores.length) throw new Error('Choisis au moins un magasin dans « Mes goûts ».');
    if (searching.current) return;
    searching.current = true;
    setPriceSearch({ stores, done: [] });
    try {
      const check = await searchPrices(plan, stores, aiAuth(d0), (store) => setPriceSearch((p) => (p ? { ...p, done: [...p.done, store] } : p)), d0.nutrition.priceCheck);
      // Par défaut, on affiche le coût des repas dans le magasin le moins cher.
      check.selectedStore = storeTotals(check)[0]?.store;
      setData((d) => ({ ...d, nutrition: { ...d.nutrition, priceCheck: check } }));
    } finally {
      searching.current = false;
      setPriceSearch(null);
    }
  }, []);

  const selectStore = useCallback((store: string) => {
    setData((d) => (d.nutrition.priceCheck ? { ...d, nutrition: { ...d.nutrition, priceCheck: { ...d.nutrition.priceCheck, selectedStore: store } } } : d));
  }, []);

  const dismissUnlocked = useCallback(() => setUnlocked((u) => u.slice(1)), []);

  const apiKey = aiAuth(data).apiKey;
  const ai = useMemo(() => aiAuth(data), [data]);
  const setAiTier = useCallback((aiTier: 'eco' | 'quality') => setData((d) => ({ ...d, aiTier })), []);
  const setHealthConsent = useCallback((ok: boolean) => setData((d) => ({ ...d, healthConsentAt: ok ? new Date().toISOString() : undefined })), []);

  const value = useMemo(
    () => ({
      ready, data, apiKey, ai, setAiTier, setHealthConsent, mutate, completeOnboarding, updateProfile, regeneratePlan, replaceDay, skipDay, restoreDay, moveDay,
      addLimitation, removeLimitation, saveCustomSession, deleteCustomSession, addLog, deleteLog, addWeight, deleteWeight,
      setReminders, setApiKey, addMessage, patchMessage, clearChat, undoMessage, setNutritionPrefs, setMealPlan, resetAll,
      unlocked, dismissUnlocked, priceSearch, findPrices, selectStore,
      localSaveFailed, retryingLocalSave, retryLocalSave,
      localLoadFailed, retryingLocalLoad, retryLocalLoad,
    }),
    [
      ready, data, apiKey, ai, setAiTier, setHealthConsent, mutate, completeOnboarding, updateProfile, regeneratePlan, replaceDay, skipDay, restoreDay, moveDay,
      addLimitation, removeLimitation, saveCustomSession, deleteCustomSession, addLog, deleteLog, addWeight, deleteWeight,
      setReminders, setApiKey, addMessage, patchMessage, clearChat, undoMessage, setNutritionPrefs, setMealPlan, resetAll,
      unlocked, dismissUnlocked, priceSearch, findPrices, selectStore,
      localSaveFailed, retryingLocalSave, retryLocalSave,
      localLoadFailed, retryingLocalLoad, retryLocalLoad,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/** On garde les modifications passées (historique) mais on repart de zéro pour le futur. */
function keepPast(overrides: AppData['overrides']) {
  const today = dateKey();
  return Object.fromEntries(Object.entries(overrides).filter(([k]) => k < today));
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp doit être utilisé dans <AppProvider>');
  return ctx;
}
