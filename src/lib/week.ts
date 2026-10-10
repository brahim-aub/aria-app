import type { CompletedSession } from '@/lib/types';

const DAY_MS = 86_400_000;

export const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
export const DAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
/** Jours affichés du lundi au dimanche. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Jours proposés par défaut selon le nombre de séances par semaine. */
export function defaultTrainingDays(count: number): number[] {
  const presets: Record<number, number[]> = {
    1: [3],
    2: [1, 4],
    3: [1, 3, 5],
    4: [1, 2, 4, 5],
    5: [1, 2, 3, 4, 5],
    6: [1, 2, 3, 4, 5, 6],
    7: [0, 1, 2, 3, 4, 5, 6],
  };
  return presets[Math.min(7, Math.max(1, count))];
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Lundi 0 h de la semaine contenant `date`. */
export function startOfWeek(date: Date) {
  const day = startOfDay(date);
  const offset = (day.getDay() + 6) % 7;
  day.setDate(day.getDate() - offset);
  return day;
}

function weekKey(date: Date) {
  return startOfWeek(date).getTime();
}

export function isSameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/** Séances terminées (hors séances arrêtées en cours) de la semaine contenant `date`. */
export function sessionsInWeek(history: CompletedSession[], date = new Date()) {
  const key = weekKey(date);
  return history.filter((item) => !item.partial && weekKey(new Date(item.completedAt)) === key);
}

/** Jours de la semaine en cours (0 = dimanche) où au moins une séance a été faite. */
export function daysDoneThisWeek(history: CompletedSession[], now = new Date()) {
  return new Set(sessionsInWeek(history, now).map((item) => new Date(item.completedAt).getDay()));
}

export function doneToday(history: CompletedSession[], now = new Date()) {
  return history.some((item) => isSameDay(new Date(item.completedAt), now));
}

function weekCounts(history: CompletedSession[]) {
  const counts = new Map<number, number>();
  for (const item of history) {
    if (item.partial) continue;
    const key = weekKey(new Date(item.completedAt));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * Série en semaines réussies : semaines consécutives où l'objectif de séances est atteint.
 * La semaine en cours ne casse pas la série tant qu'elle n'est pas finie.
 */
export function weekStreak(history: CompletedSession[], weeklyGoal: number, now = new Date()) {
  const counts = weekCounts(history);
  const goal = Math.max(1, weeklyGoal);
  const cursor = startOfWeek(now);
  let streak = (counts.get(cursor.getTime()) ?? 0) >= goal ? 1 : 0;
  cursor.setDate(cursor.getDate() - 7);
  while ((counts.get(cursor.getTime()) ?? 0) >= goal) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

/** Plus longue série de semaines réussies jamais atteinte. */
export function bestWeekStreak(history: CompletedSession[], weeklyGoal: number) {
  const goal = Math.max(1, weeklyGoal);
  const weeks = Array.from(weekCounts(history).entries())
    .filter(([, count]) => count >= goal)
    .map(([key]) => key)
    .sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  for (let i = 0; i < weeks.length; i++) {
    const consecutive = i > 0 && Math.round((weeks[i] - weeks[i - 1]) / (7 * DAY_MS)) === 1;
    run = consecutive ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

/** Prochain jour d'entraînement à partir de demain : « demain » ou le nom du jour. */
export function nextTrainingDayLabel(trainingDays: number[], now = new Date()) {
  if (trainingDays.length === 0) return null;
  for (let offset = 1; offset <= 7; offset++) {
    const day = (now.getDay() + offset) % 7;
    if (trainingDays.includes(day)) return offset === 1 ? 'demain' : DAY_NAMES[day];
  }
  return null;
}
