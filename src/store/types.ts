export type Sex = 'homme' | 'femme' | 'autre';
export type Goal = 'perte' | 'forme' | 'muscle' | 'force' | 'endurance' | 'sante';
export type Level = 'debutant' | 'intermediaire' | 'confirme' | 'expert';
export type SportHistory = 'jamais' | 'parfois' | 'regulier';
export type Place = 'maison' | 'salle' | 'exterieur';
export type Equipment = 'dumbbells' | 'bands' | 'kettlebell' | 'pullup_bar' | 'bench' | 'barbell' | 'machines';
export type JobActivity = 'assis' | 'debout' | 'physique';
export type BodyPart = 'poignet' | 'coude' | 'epaule' | 'nuque' | 'dos' | 'genou' | 'hanche' | 'cheville';
export type Muscle =
  | 'pectoraux'
  | 'dos'
  | 'epaules'
  | 'biceps'
  | 'triceps'
  | 'abdos'
  | 'fessiers'
  | 'quadriceps'
  | 'ischios'
  | 'mollets'
  | 'cardio'
  | 'mobilite';

export type Profile = {
  onboarded: boolean;
  name: string;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  goal: Goal;
  level: Level;
  history: SportHistory;
  place: Place;
  equipment: Equipment[];
  sessionsPerWeek: number;
  sessionMinutes: number;
  /** 0 = lundi … 6 = dimanche */
  trainingDays: number[];
  job: JobActivity;
  wantsNutrition: boolean;
};

export type SessionExercise = {
  exerciseId: string;
  sets: number;
  reps?: number;
  seconds?: number;
  restSec: number;
  weightKg?: number;
};

export type WorkoutSession = {
  id: string;
  title: string;
  focus?: string;
  warmup: boolean;
  cooldown: boolean;
  exercises: SessionExercise[];
  /** 'sets' : séries enchaînées exercice par exercice ; 'circuit' : un tour de chaque exercice, plusieurs tours. */
  format?: 'sets' | 'circuit';
  source: 'plan' | 'preset' | 'custom' | 'ai';
  level?: Level;
  /** Pourquoi la séance a été modifiée (affiché à l'utilisateur). */
  note?: string;
};

export type Override =
  | { kind: 'replace'; session: WorkoutSession; reason?: string }
  | { kind: 'skip'; reason?: string; movedTo?: string };

export type Limitation = {
  id: string;
  bodyPart: BodyPart;
  note: string;
  /** YYYY-MM-DD inclus */
  startDate: string;
  endDate: string;
};

export type Plan = {
  /** YYYY-MM-DD : date de début de la rotation */
  startDate: string;
  templates: WorkoutSession[];
};

export type SetLog = { reps?: number; seconds?: number; weightKg?: number };

export type LogEntry = {
  id: string;
  date: string;
  /** Jour du planning auquel la séance correspond (YYYY-MM-DD). */
  scheduledDate?: string;
  kind: 'program' | 'free';
  programId?: string;
  title: string;
  durationMin: number;
  difficulty: number;
  energy: number;
  note?: string;
  exercises?: { exerciseId: string; sets: SetLog[] }[];
  volumeKg?: number;
  kcal?: number;
};

export type WeightEntry = { id: string; date: string; kg: number };

export type Reminders = {
  enabled: boolean;
  /** expo-notifications weekday: 1 = dimanche … 7 = samedi */
  days: number[];
  hour: number;
  minute: number;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'model';
  text: string;
  date: string;
  /** Résumé lisible des modifications appliquées par le coach. */
  changes?: string[];
  quickReplies?: string[];
  error?: boolean;
  link?: 'programme' | 'nutrition';
  pending?: boolean;
  /** Présent tant que les modifications peuvent être annulées. */
  undo?: UndoSnapshot;
  /** État après l’action, utilisé pour protéger les changements ultérieurs. */
  undoAfter?: UndoSnapshot;
};

export type UndoSnapshot = Pick<AppData, 'profile' | 'plan' | 'overrides' | 'limitations' | 'nutrition' | 'customSessions'>;

export type Diet = 'omnivore' | 'vegetarien' | 'vegan' | 'pescetarien' | 'sans_porc';

export type NutritionPrefs = {
  diet: Diet;
  likes: string;
  dislikes: string;
  allergies: string;
  mealsPerDay: number;
  cookingTime: 'rapide' | 'moyen' | 'long';
  budget: 'serre' | 'moyen' | 'large';
  /** Budget courses maximum en euros par semaine (0 = pas de limite). */
  weeklyBudget?: number;
  /** Magasins où l'utilisateur fait ses courses. */
  stores?: string[];
};

export type MealItem = {
  food: string;
  qty: string;
  kcal: number;
  /** Poids (ou volume en ml) consommé, en grammes. */
  grams?: number;
  /** Nom précis du produit en rayon (sert à chercher son prix). */
  search?: string;
};
export type Meal = { name: string; time?: string; items: MealItem[]; kcal: number; proteinG?: number; recipe?: string };
export type MealDay = { day: string; meals: Meal[]; kcal: number };

export type MealPlan = {
  createdAt: string;
  targetKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  days: MealDay[];
  groceries: string[];
  tips: string[];
};

export type Nutrition = { prefs: NutritionPrefs; plan?: MealPlan; prefsSet: boolean; priceCheck?: PriceCheck };

/** Prix d'un ingrédient dans un magasin. */
export type StoreItemPrice = {
  /** Identifiant de l'ingrédient dans la liste envoyée à l'IA. */
  id: string;
  product: string;
  packSize: string;
  /** Contenu du paquet en g (ou ml). */
  packGrams: number;
  packPrice: number;
  pricePerKg: number;
  /** Page web où le prix a été trouvé (obligatoire : pas de prix sans source). */
  url: string;
  /** Date à laquelle le prix a été relevé en ligne. */
  foundAt?: string;
  /** true : prix lu en ligne pendant une recherche Google. false : prix indicatif donné par l'IA. */
  verified?: boolean;
  /** Fourchette au kilo des variantes vues dans ce magasin (ex. plusieurs riz basmati). */
  minPerKg?: number;
  maxPerKg?: number;
};

export type StorePrices = { store: string; items: StoreItemPrice[]; note?: string };

export type PriceCheck = {
  /** Plan de repas concerné (createdAt). */
  planCreatedAt: string;
  searchedAt: string;
  sources: { title: string; url: string }[];
  /** Ingrédients interrogés : id → nom et quantité sur la semaine. */
  ingredients: { id: string; name: string; grams: number }[];
  stores: StorePrices[];
  /** Magasin choisi pour afficher le coût des repas. */
  selectedStore?: string;
};


export type Counters = {
  chatMessages: number;
  aiAdaptations: number;
  customCreated: number;
  mealPlans: number;
};

export type AppData = {
  version: 2;
  profile: Profile;
  plan: Plan;
  overrides: Record<string, Override>;
  limitations: Limitation[];
  customSessions: WorkoutSession[];
  logs: LogEntry[];
  weights: WeightEntry[];
  reminders: Reminders;
  chat: ChatMessage[];
  nutrition: Nutrition;
  /** id du succès → date de déblocage */
  achievements: Record<string, string>;
  counters: Counters;
  apiKey: string;
  /** Modèle du coach et des menus : économique (Flash-Lite, par défaut) ou qualité (Flash). */
  aiTier?: 'eco' | 'quality';
  /** Consommation IA du mois en cours, mesurée sur les réponses de Gemini. */
  aiUsage?: AiUsageMonth;
  /** Date du consentement au traitement des données de santé (douleurs, poids) par le coach IA. */
  healthConsentAt?: string;
};

export type AiUsageTotals = { usageVersion?: 2; legacyEstimate?: boolean; calls: number; tokensIn: number; tokensCached: number; tokensOut: number; searches: number; costUsd: number };
export type AiUsageMonth = { month: string; kinds: Partial<Record<'chat' | 'meal' | 'prices' | 'test', AiUsageTotals>> };
