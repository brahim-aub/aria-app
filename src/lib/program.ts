import { EXERCISES, getExercise } from '@/data/exercises';
import type { Category, Exercise, Goal, Profile, Session, SessionStep, Zone } from '@/lib/types';

const MAIN_BLOCKS: Record<Goal, Category[]> = {
  perte_poids: ['cardio', 'bas', 'haut', 'cardio', 'gainage'],
  muscle: ['haut', 'bas', 'haut', 'bas', 'gainage'],
  forme: ['cardio', 'haut', 'bas', 'gainage'],
  souplesse: ['mobilite', 'gainage', 'mobilite', 'bas'],
  reprise: ['bas', 'haut', 'gainage'],
};

const REST_BY_LEVEL = { 1: 45, 2: 35, 3: 25 } as const;
const SECONDS_PER_REP = 3;
const MAX_SETS = 4;

export interface SessionOptions {
  /** Minutes disponibles aujourd'hui ; par défaut celles du profil. */
  minutes?: number;
  /** Douleurs du jour, en plus de celles du profil. */
  extraPainZones?: Zone[];
  /** Multiplicateur appliqué aux répétitions et durées (ajusté par le ressenti). */
  intensity?: number;
  /** Graine pour varier les exercices d'un jour à l'autre. */
  seed?: number;
}

function hasEquipment(exercise: Exercise, profile: Profile) {
  return exercise.equipment.every((item) => profile.equipment.includes(item));
}

/**
 * Remplace un exercice par ses variantes plus faciles jusqu'à en trouver une compatible
 * avec le niveau, le matériel et les zones à ménager. Renvoie undefined s'il n'y en a pas.
 */
export function adaptExercise(
  exercise: Exercise,
  profile: Profile,
  avoided: Zone[],
): Exercise | undefined {
  let current: Exercise | undefined = exercise;
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    const ok =
      current.level <= profile.level &&
      hasEquipment(current, profile) &&
      !current.stresses.some((zone) => avoided.includes(zone));
    if (ok) return current;
    current = current.easierId ? getExercise(current.easierId) : undefined;
  }
  return undefined;
}

function candidatesFor(category: Category, profile: Profile, avoided: Zone[]) {
  const result: Exercise[] = [];
  for (const exercise of EXERCISES) {
    if (exercise.category !== category) continue;
    const adapted = adaptExercise(exercise, profile, avoided);
    if (adapted && !result.some((item) => item.id === adapted.id)) result.push(adapted);
  }
  // Les exercices les plus proches du niveau de la personne passent en premier.
  return result.sort((a, b) => b.level - a.level);
}

function workSeconds(exercise: Exercise, amount: number) {
  return exercise.mode === 'time' ? amount : amount * SECONDS_PER_REP;
}

export function estimateSeconds(steps: SessionStep[]) {
  return steps.reduce((total, step) => {
    const exercise = getExercise(step.exerciseId);
    if (!exercise) return total;
    return total + step.sets * (workSeconds(exercise, step.amount) + step.restSeconds);
  }, 0);
}

export function buildSession(profile: Profile, options: SessionOptions = {}): Session {
  const minutes = options.minutes ?? profile.minutesPerSession;
  const intensity = options.intensity ?? 1;
  const seed = options.seed ?? Math.floor(Date.now() / 86_400_000);
  const avoided = Array.from(new Set([...profile.painZones, ...(options.extraPainZones ?? [])]));
  const rest = REST_BY_LEVEL[profile.level];
  const used = new Set<string>();

  const pick = (category: Category, offset: number) => {
    const candidates = candidatesFor(category, profile, avoided).filter((e) => !used.has(e.id));
    if (candidates.length === 0) return undefined;
    const chosen = candidates[(seed + offset) % candidates.length];
    used.add(chosen.id);
    return chosen;
  };

  const toStep = (exercise: Exercise, sets: number, restSeconds: number): SessionStep => ({
    exerciseId: exercise.id,
    sets,
    amount: Math.max(5, Math.round(exercise.amount * intensity)),
    restSeconds,
  });

  const warmUp = [pick('mobilite', 0), pick('cardio', 1)]
    .filter((e): e is Exercise => Boolean(e))
    .map((e) => toStep(e, 1, 10));
  const coolDown = [pick('mobilite', 2)]
    .filter((e): e is Exercise => Boolean(e))
    .map((e) => toStep(e, 1, 0));
  const main = MAIN_BLOCKS[profile.goal]
    .map((category, index) => pick(category, index + 3))
    .filter((e): e is Exercise => Boolean(e))
    .map((e) => toStep(e, 1, rest));

  // On ajoute des séries au bloc principal tant que la séance tient dans le temps disponible.
  const budget = minutes * 60;
  let changed = true;
  while (changed) {
    changed = false;
    for (const step of main) {
      if (step.sets >= MAX_SETS) continue;
      step.sets += 1;
      if (estimateSeconds([...warmUp, ...main, ...coolDown]) > budget) {
        step.sets -= 1;
      } else {
        changed = true;
      }
    }
  }

  return {
    id: `${Date.now()}`,
    title: options.extraPainZones?.length || options.minutes ? 'Séance adaptée' : 'Séance du jour',
    createdAt: new Date().toISOString(),
    minutes,
    avoidedZones: avoided,
    steps: [...warmUp, ...main, ...coolDown],
  };
}
