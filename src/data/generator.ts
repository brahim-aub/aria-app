import { fitToDuration, LEVEL_MAX, prescribe } from '@/lib/workout';
import type { BodyPart, Equipment, Goal, Level, Muscle, Place, Profile, WorkoutSession } from '@/store/types';

import { EXERCISE_LIST, Exercise, ExerciseCategory, isAvailable } from './exercises';

type Slot = { muscle: Muscle; category?: ExerciseCategory };
type Day = { title: string; focus: string; slots: Slot[] };

const S = (muscle: Muscle, category?: ExerciseCategory): Slot => ({ muscle, category });

const FULL_A: Day = { title: 'Full body A', focus: 'Tout le corps', slots: [S('quadriceps'), S('pectoraux'), S('dos'), S('fessiers'), S('abdos', 'core'), S('cardio', 'cardio')] };
const FULL_B: Day = { title: 'Full body B', focus: 'Tout le corps', slots: [S('fessiers'), S('epaules'), S('dos'), S('ischios'), S('abdos', 'core'), S('cardio', 'cardio')] };
const FULL_C: Day = { title: 'Full body C', focus: 'Tout le corps & cardio', slots: [S('cardio', 'cardio'), S('quadriceps'), S('pectoraux'), S('dos'), S('abdos', 'core'), S('fessiers')] };
const UPPER: Day = { title: 'Haut du corps', focus: 'Pectoraux, dos, épaules, bras', slots: [S('pectoraux'), S('dos'), S('epaules'), S('dos'), S('biceps'), S('triceps'), S('abdos', 'core')] };
const LOWER: Day = { title: 'Bas du corps', focus: 'Cuisses, fessiers, mollets', slots: [S('quadriceps'), S('ischios'), S('fessiers'), S('quadriceps'), S('mollets'), S('abdos', 'core')] };
const PUSH: Day = { title: 'Push', focus: 'Pectoraux, épaules, triceps', slots: [S('pectoraux'), S('epaules'), S('pectoraux'), S('epaules'), S('triceps'), S('abdos', 'core')] };
const PULL: Day = { title: 'Pull', focus: 'Dos, biceps', slots: [S('dos'), S('dos'), S('epaules'), S('biceps'), S('biceps'), S('abdos', 'core')] };
const LEGS: Day = { title: 'Jambes', focus: 'Cuisses, fessiers, ischios', slots: [S('quadriceps'), S('ischios'), S('fessiers'), S('quadriceps'), S('mollets'), S('abdos', 'core')] };
const CARDIO: Day = { title: 'Cardio & gainage', focus: 'Souffle, abdos', slots: [S('cardio', 'cardio'), S('abdos', 'core'), S('cardio', 'cardio'), S('quadriceps'), S('abdos', 'core'), S('cardio', 'cardio')] };

function splitFor(p: Profile): Day[] {
  const n = p.sessionsPerWeek;
  const advanced = p.level === 'confirme' || p.level === 'expert';
  const cardioGoal = p.goal === 'perte' || p.goal === 'endurance';
  if (n <= 1) return [FULL_A];
  if (n === 2) return [FULL_A, FULL_B];
  if (n === 3) return advanced && p.place === 'salle' ? [PUSH, PULL, LEGS] : cardioGoal ? [FULL_A, CARDIO, FULL_B] : [FULL_A, FULL_B, FULL_C];
  if (n === 4) return cardioGoal ? [UPPER, LOWER, CARDIO, FULL_A] : [UPPER, LOWER, { ...UPPER, title: 'Haut du corps B' }, { ...LOWER, title: 'Bas du corps B' }];
  if (n === 5) return [PUSH, PULL, LEGS, cardioGoal ? CARDIO : UPPER, cardioGoal ? FULL_A : LOWER];
  return [PUSH, PULL, LEGS, { ...PUSH, title: 'Push B' }, { ...PULL, title: 'Pull B' }, { ...LEGS, title: 'Jambes B' }];
}

type PickContext = { equipment: Equipment[]; avoid: BodyPart[]; maxLevel: number; place: Place; variant: number };

function pick(slot: Slot, ctx: PickContext, used: Set<string>): Exercise | undefined {
  const cat = slot.category ?? 'strength';
  const candidates = EXERCISE_LIST.filter(
    (e) =>
      e.category === cat &&
      !used.has(e.id) &&
      isAvailable(e, ctx.equipment) &&
      e.level <= ctx.maxLevel &&
      !e.stresses.some((p) => ctx.avoid.includes(p)) &&
      e.muscles.includes(slot.muscle),
  )
    .map((e) => {
      let score = e.muscles[0] === slot.muscle ? 4 : 1;
      // À la salle on privilégie le matériel, à la maison le poids du corps / petit matériel.
      if (ctx.place === 'salle' && e.equipment.length) score += 2;
      if (ctx.place !== 'salle' && e.equipment.includes('machines')) score -= 3;
      score += e.level === ctx.maxLevel ? 1 : 0;
      return { e, score };
    })
    .sort((a, b) => b.score - a.score);
  if (!candidates.length) return undefined;
  const top = candidates.filter((c) => c.score >= candidates[0].score - 1);
  return top[ctx.variant % top.length].e;
}

export function buildDay(day: Day, p: Pick<Profile, 'equipment' | 'level' | 'goal' | 'place' | 'sessionMinutes'>, opts: { avoid?: BodyPart[]; variant?: number; id?: string } = {}): WorkoutSession {
  const ctx: PickContext = {
    equipment: p.equipment,
    avoid: opts.avoid ?? [],
    maxLevel: LEVEL_MAX[p.level],
    place: p.place,
    variant: opts.variant ?? 0,
  };
  const used = new Set<string>();
  const exercises = day.slots
    .map((slot) => {
      const e = pick(slot, ctx, used);
      if (!e) return undefined;
      used.add(e.id);
      return prescribe(e, p.goal, p.level);
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  const bodyweightOnly = exercises.every((e) => !EXERCISE_LIST.find((x) => x.id === e.exerciseId)?.loaded);
  const circuit = bodyweightOnly && (p.goal === 'perte' || p.goal === 'endurance' || p.goal === 'forme' || p.goal === 'sante' || p.level === 'debutant');
  const session: WorkoutSession = {
    id: opts.id ?? day.title,
    title: day.title,
    focus: day.focus,
    warmup: true,
    cooldown: true,
    exercises,
    format: circuit ? 'circuit' : 'sets',
    source: 'plan',
    level: p.level,
  };
  return fitToDuration(session, p.sessionMinutes);
}

export function generateTemplates(p: Profile): WorkoutSession[] {
  return splitFor(p).map((day, i) => buildDay(day, p, { variant: i, id: `plan-${i}` }));
}

/** Jours d'entraînement par défaut selon la fréquence (0 = lundi). */
export function defaultDays(n: number): number[] {
  const map: Record<number, number[]> = {
    1: [2],
    2: [1, 4],
    3: [0, 2, 4],
    4: [0, 1, 3, 4],
    5: [0, 1, 2, 4, 5],
    6: [0, 1, 2, 3, 4, 5],
    7: [0, 1, 2, 3, 4, 5, 6],
  };
  return map[Math.min(7, Math.max(1, n))];
}

export const GOAL_LABEL: Record<Goal, string> = {
  perte: 'Perdre du poids',
  forme: 'Me remettre en forme',
  muscle: 'Prendre du muscle',
  force: 'Gagner en force',
  endurance: 'Améliorer mon endurance',
  sante: 'Rester en bonne santé',
};

export const LEVEL_LABEL: Record<Level, string> = {
  debutant: 'Débutant',
  intermediaire: 'Intermédiaire',
  confirme: 'Confirmé',
  expert: 'Expert',
};

export const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
export const DAY_LONG = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
