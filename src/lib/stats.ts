import type { CompletedSession } from '@/lib/types';

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Nombre de jours d'affilée avec au moins une séance, en comptant aujourd'hui ou hier. */
export function currentStreak(history: CompletedSession[], now = new Date()) {
  const days = new Set(history.map((item) => dayKey(new Date(item.completedAt))));
  const cursor = new Date(now);
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Plus longue série de jours consécutifs jamais atteinte. */
export function bestStreak(history: CompletedSession[]) {
  const days = Array.from(
    new Set(
      history.map((item) => {
        const d = new Date(item.completedAt);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      }),
    ),
  ).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    const gapDays = i === 0 ? 0 : Math.round((days[i] - days[i - 1]) / 86_400_000);
    run = gapDays === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

export function totalReps(history: CompletedSession[], exerciseIds?: string[]) {
  let total = 0;
  for (const item of history) {
    for (const [id, reps] of Object.entries(item.reps)) {
      if (!exerciseIds || exerciseIds.includes(id)) total += reps;
    }
  }
  return total;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  points: number;
  /** Progression actuelle et objectif, pour afficher une barre. */
  progress: (history: CompletedSession[]) => { value: number; target: number };
}

const PUSH_UPS = ['pompes', 'pompes-genoux', 'pompes-mur'];

function sessionsAchievement(target: number, points: number): Achievement {
  return {
    id: `seances-${target}`,
    title: target === 1 ? 'Premier pas' : `${target} séances`,
    description: target === 1 ? 'Termine ta première séance.' : `Termine ${target} séances.`,
    points,
    progress: (history) => ({ value: history.length, target }),
  };
}

function pushUpsAchievement(target: number, points: number): Achievement {
  return {
    id: `pompes-${target}`,
    title: `${target.toLocaleString('fr-FR')} pompes`,
    description: `Cumule ${target.toLocaleString('fr-FR')} pompes, toutes variantes comprises.`,
    points,
    progress: (history) => ({ value: totalReps(history, PUSH_UPS), target }),
  };
}

function streakAchievement(target: number, points: number): Achievement {
  return {
    id: `serie-${target}`,
    title: `${target} jours d'affilée`,
    description: `Entraîne-toi ${target} jours de suite.`,
    points,
    progress: (history) => ({ value: bestStreak(history), target }),
  };
}

export const ACHIEVEMENTS: Achievement[] = [
  sessionsAchievement(1, 10),
  sessionsAchievement(5, 20),
  sessionsAchievement(10, 30),
  sessionsAchievement(25, 50),
  streakAchievement(3, 15),
  streakAchievement(7, 40),
  pushUpsAchievement(100, 15),
  pushUpsAchievement(1000, 40),
  pushUpsAchievement(10000, 100),
];

export function isUnlocked(achievement: Achievement, history: CompletedSession[]) {
  const { value, target } = achievement.progress(history);
  return value >= target;
}

export function achievementPoints(history: CompletedSession[]) {
  return ACHIEVEMENTS.filter((a) => isUnlocked(a, history)).reduce((sum, a) => sum + a.points, 0);
}
