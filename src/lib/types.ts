export type Zone = 'poignets' | 'genoux' | 'dos' | 'epaules';

export type Equipment = 'tapis' | 'elastique' | 'halteres';

export type Goal = 'perte_poids' | 'muscle' | 'forme' | 'souplesse' | 'reprise';

export type Level = 1 | 2 | 3;

export type Sex = 'homme' | 'femme';

export type Category = 'haut' | 'bas' | 'gainage' | 'cardio' | 'mobilite';

export interface Exercise {
  id: string;
  name: string;
  category: Category;
  level: Level;
  /** Matériel requis ; vide = poids du corps. */
  equipment: Equipment[];
  /** Zones sollicitées : l'exercice est évité ou remplacé si l'une d'elles est douloureuse. */
  stresses: Zone[];
  mode: 'reps' | 'time';
  /** Répétitions par série (mode reps) ou secondes (mode time). */
  amount: number;
  instructions: string[];
  why: string;
  /** Variante plus facile ou plus douce pour les articulations. */
  easierId?: string;
}

export interface Profile {
  firstName: string;
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  goal: Goal;
  level: Level;
  equipment: Equipment[];
  minutesPerSession: number;
  daysPerWeek: number;
  painZones: Zone[];
}

export interface SessionStep {
  exerciseId: string;
  sets: number;
  amount: number;
  restSeconds: number;
}

export interface Session {
  id: string;
  title: string;
  createdAt: string;
  minutes: number;
  /** Zones évitées pour cette séance (profil + douleurs du jour). */
  avoidedZones: Zone[];
  steps: SessionStep[];
}

export type Feeling = 'facile' | 'bien' | 'dur';

export interface CompletedSession {
  sessionId: string;
  title: string;
  completedAt: string;
  durationSeconds: number;
  feeling: Feeling;
  /** Total de répétitions par exercice, pour les succès. */
  reps: Record<string, number>;
}
