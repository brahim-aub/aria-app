import { EXERCISE_LIST, EXERCISES, Exercise, exerciseName, isAvailable } from '@/data/exercises';
import type { BodyPart, Equipment, Goal, Level, SessionExercise, WorkoutSession } from '@/store/types';

export type WorkStep = {
  type: 'work';
  exerciseId: string;
  mode: 'time' | 'reps';
  amount: number;
  phase: 'warmup' | 'main' | 'cooldown';
  /** index dans session.exercises */
  exIndex?: number;
  set?: number;
  sets?: number;
  weightKg?: number;
};
export type RestStep = { type: 'rest'; seconds: number; label: string };
export type Step = WorkStep | RestStep;

const SECONDS_PER_REP = 3;
const TRANSITION = 15;

export const LEVEL_MAX: Record<Level, 1 | 2 | 3> = { debutant: 1, intermediaire: 2, confirme: 3, expert: 3 };

export type AdaptContext = { equipment: Equipment[]; avoid: BodyPart[]; maxLevel?: 1 | 2 | 3 };

// ───────── Durées ─────────

export function setSeconds(e: SessionExercise) {
  const ex = EXERCISES[e.exerciseId];
  if (e.seconds && (!ex || ex.mode === 'time')) return e.seconds;
  return (e.reps ?? 10) * (ex?.loaded ? SECONDS_PER_REP + 0.5 : SECONDS_PER_REP);
}

export function mainSeconds(s: WorkoutSession) {
  let total = 0;
  s.exercises.forEach((e, i) => {
    total += e.sets * setSeconds(e) + (e.sets - 1) * e.restSec;
    if (i < s.exercises.length - 1) total += Math.max(e.restSec, 30) + TRANSITION;
  });
  return total;
}

const isCompact = (s: WorkoutSession) => mainSeconds(s) < 12 * 60;

export function estimateMinutes(s: WorkoutSession) {
  const compact = isCompact(s);
  const warm = s.warmup ? (compact ? 110 : 210) : 0;
  const cool = s.cooldown ? (compact ? 80 : 200) : 0;
  return Math.max(1, Math.round((mainSeconds(s) + warm + cool) / 60));
}

/** Dépense estimée en kcal (MET × poids × heures). */
export function estimateKcal(s: WorkoutSession, weightKg: number) {
  let metSec = 0;
  s.exercises.forEach((e) => {
    const met = EXERCISES[e.exerciseId]?.met ?? 4;
    metSec += e.sets * setSeconds(e) * met + (e.sets - 1) * e.restSec * 1.8;
  });
  const extra = (estimateMinutes(s) * 60 - mainSeconds(s)) * 3;
  return Math.round((weightKg * (metSec + Math.max(0, extra))) / 3600);
}

export function prescriptionLabel(e: SessionExercise) {
  const ex = EXERCISES[e.exerciseId];
  const amount = ex?.mode === 'time' || (e.seconds && !e.reps) ? `${e.seconds ?? 30} s` : `${e.reps ?? 10} reps`;
  const w = e.weightKg ? ` · ${e.weightKg} kg` : '';
  return `${e.sets} × ${amount}${w}`;
}

// ───────── Étapes du lecteur ─────────

function pickWarmupCardio(avoid: BodyPart[]) {
  return ['jumping', 'montees', 'shadowBoxing', 'marche'].find((id) => !EXERCISES[id].stresses.some((p) => avoid.includes(p))) ?? 'marche';
}

export function buildSteps(s: WorkoutSession, avoid: BodyPart[] = []): Step[] {
  const compact = isCompact(s);
  const steps: Step[] = [];
  if (s.warmup) {
    steps.push({ type: 'work', exerciseId: 'marche', mode: 'time', amount: compact ? 40 : 60, phase: 'warmup' });
    steps.push({ type: 'work', exerciseId: 'rotations', mode: 'time', amount: compact ? 40 : 90, phase: 'warmup' });
    steps.push({ type: 'work', exerciseId: pickWarmupCardio(avoid), mode: 'time', amount: 30, phase: 'warmup' });
    steps.push({ type: 'rest', seconds: compact ? 10 : 30, label: 'Prépare-toi, ça commence' });
  }

  const work = (e: SessionExercise, i: number, set: number): WorkStep => {
    const ex = EXERCISES[e.exerciseId];
    const timed = ex?.mode === 'time' || (!!e.seconds && !e.reps);
    return {
      type: 'work',
      exerciseId: e.exerciseId,
      mode: timed ? 'time' : 'reps',
      amount: timed ? (e.seconds ?? 30) : (e.reps ?? 10),
      phase: 'main',
      exIndex: i,
      set,
      sets: e.sets,
      weightKg: e.weightKg,
    };
  };

  if (s.format === 'circuit') {
    const rounds = Math.max(...s.exercises.map((e) => e.sets), 1);
    for (let r = 1; r <= rounds; r++) {
      const inRound = s.exercises.map((e, i) => ({ e, i })).filter(({ e }) => e.sets >= r);
      inRound.forEach(({ e, i }, k) => {
        steps.push({ ...work(e, i, r), sets: rounds });
        const last = k === inRound.length - 1;
        if (!last) steps.push({ type: 'rest', seconds: e.restSec, label: 'Récupération' });
        else if (r < rounds) steps.push({ type: 'rest', seconds: Math.max(60, e.restSec * 2), label: `Fin du tour ${r}/${rounds}` });
      });
    }
  } else {
    s.exercises.forEach((e, i) => {
      for (let set = 1; set <= e.sets; set++) {
        steps.push(work(e, i, set));
        const lastSet = set === e.sets;
        const lastEx = i === s.exercises.length - 1;
        if (!lastSet) steps.push({ type: 'rest', seconds: e.restSec, label: `Série ${set + 1}/${e.sets} ensuite` });
        else if (!lastEx) steps.push({ type: 'rest', seconds: Math.max(e.restSec, 30), label: 'Exercice suivant' });
      }
    });
  }

  if (s.cooldown) {
    steps.push({ type: 'rest', seconds: 15, label: 'Bravo, place au retour au calme' });
    steps.push({ type: 'work', exerciseId: 'etirements', mode: 'time', amount: compact ? 60 : 180, phase: 'cooldown' });
  }
  return steps;
}

export function stepSeconds(s: Step) {
  if (s.type === 'rest') return s.seconds;
  return s.mode === 'time' ? s.amount : s.amount * SECONDS_PER_REP;
}

// ───────── Adaptation (douleurs, matériel) ─────────

const fits = (ex: Exercise, ctx: AdaptContext) =>
  isAvailable(ex, ctx.equipment) && !ex.stresses.some((p) => ctx.avoid.includes(p)) && (!ctx.maxLevel || ex.level <= ctx.maxLevel);

/** Exercice de remplacement travaillant les mêmes muscles, compatible avec le contexte. */
export function findSubstitute(id: string, ctx: AdaptContext, exclude: Set<string> = new Set()) {
  const src = EXERCISES[id];
  if (!src) return undefined;
  const scored = EXERCISE_LIST.filter((c) => c.id !== id && !exclude.has(c.id) && c.category !== 'warmup' && fits(c, ctx))
    // Il faut au moins un muscle en commun, sinon on retire l'exercice plutôt que de le remplacer par n'importe quoi.
    .filter((c) => c.muscles.some((m) => src.muscles.includes(m)))
    .map((c) => {
      let score = 0;
      if (c.muscles[0] === src.muscles[0]) score += 4;
      score += c.muscles.filter((m) => src.muscles.includes(m)).length * 2;
      if (c.category === src.category) score += 2;
      if (c.mode === src.mode) score += 1;
      score -= Math.abs(c.level - src.level);
      return { c, score };
    })
    .filter((x) => x.score >= 3)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.c;
}

export function adaptSession(s: WorkoutSession, ctx: AdaptContext): { session: WorkoutSession; changes: string[] } {
  const changes: string[] = [];
  const used = new Set(s.exercises.map((e) => e.exerciseId));
  const exercises: SessionExercise[] = [];
  for (const e of s.exercises) {
    const ex = EXERCISES[e.exerciseId];
    if (!ex) continue;
    if (fits(ex, { ...ctx, maxLevel: undefined })) {
      exercises.push(e);
      continue;
    }
    const sub = findSubstitute(e.exerciseId, ctx, used);
    if (sub) {
      used.add(sub.id);
      changes.push(`${ex.name} → ${sub.name}`);
      exercises.push({
        ...e,
        exerciseId: sub.id,
        reps: sub.mode === 'reps' ? (e.reps ?? 12) : undefined,
        seconds: sub.mode === 'time' ? (e.seconds ?? 30) : undefined,
        weightKg: sub.loaded ? e.weightKg : undefined,
      });
    } else {
      changes.push(`${ex.name} retiré`);
    }
  }
  if (!changes.length) return { session: s, changes };
  return { session: { ...s, exercises }, changes };
}

// ───────── Ajustement à une durée ─────────

export function fitToDuration(s: WorkoutSession, minutes: number): WorkoutSession {
  let cur: WorkoutSession = { ...s, exercises: s.exercises.map((e) => ({ ...e })) };
  const target = Math.max(5, minutes);
  let guard = 0;
  while (estimateMinutes(cur) > target && guard++ < 60) {
    const maxSets = Math.max(...cur.exercises.map((e) => e.sets));
    if (maxSets > 2) {
      const i = cur.exercises.findIndex((e) => e.sets === maxSets);
      cur.exercises[i].sets--;
    } else if (cur.exercises.length > 3) {
      cur.exercises.pop();
    } else if (cur.exercises.some((e) => e.restSec > 20)) {
      cur.exercises.forEach((e) => (e.restSec = Math.max(20, e.restSec - 10)));
    } else if (maxSets > 1) {
      const i = cur.exercises.findIndex((e) => e.sets === maxSets);
      cur.exercises[i].sets--;
    } else if (cur.exercises.length > 1) {
      cur.exercises.pop();
    } else break;
  }
  guard = 0;
  while (estimateMinutes(cur) < target - 2 && guard++ < 40) {
    const minSets = Math.min(...cur.exercises.map((e) => e.sets));
    if (minSets >= 5) break;
    const i = cur.exercises.findIndex((e) => e.sets === minSets);
    cur.exercises[i].sets++;
    if (estimateMinutes(cur) > target) {
      cur.exercises[i].sets--;
      break;
    }
  }
  return cur;
}

// ───────── Prescriptions ─────────

export function prescribe(ex: Exercise, goal: Goal, level: Level): SessionExercise {
  const sets = { debutant: 2, intermediaire: 3, confirme: 3, expert: 4 }[level];
  let reps = { perte: 15, endurance: 15, forme: 12, sante: 12, muscle: 10, force: 6 }[goal];
  if (!ex.loaded) reps = Math.max(reps, level === 'debutant' ? 8 : 10);
  if (ex.id === 'burpees' || ex.id === 'squatSaute') reps = Math.min(reps, level === 'debutant' ? 6 : 10);
  if (ex.id === 'tractions') reps = level === 'expert' ? 8 : 5;
  const seconds = ex.category === 'cardio' ? { debutant: 30, intermediaire: 40, confirme: 45, expert: 50 }[level] : { debutant: 25, intermediaire: 35, confirme: 45, expert: 60 }[level];
  let restSec = { force: 120, muscle: 75, forme: 50, sante: 50, perte: 35, endurance: 30 }[goal];
  if (level === 'debutant') restSec += 15;
  if (ex.category === 'cardio' || ex.category === 'core') restSec = Math.min(restSec, 45);
  return {
    exerciseId: ex.id,
    sets: ex.category === 'cardio' && ex.mode === 'time' && ex.equipment.includes('machines') ? 1 : sets,
    reps: ex.mode === 'reps' ? reps : undefined,
    seconds: ex.mode === 'time' ? (ex.equipment.includes('machines') && ex.category === 'cardio' ? 600 : seconds) : undefined,
    restSec,
  };
}

export function sessionSummary(s: WorkoutSession) {
  return s.exercises.map((e) => exerciseName(e.exerciseId)).join(' · ');
}

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
