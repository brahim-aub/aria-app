import type { CompletedSession } from '@/lib/types';
import { bestWeekStreak } from '@/lib/week';

export function totalReps(history: CompletedSession[], exerciseIds?: string[]) {
  let total = 0;
  for (const item of history) {
    for (const [id, reps] of Object.entries(item.reps)) {
      if (!exerciseIds || exerciseIds.includes(id)) total += reps;
    }
  }
  return total;
}

export function totalMinutes(history: CompletedSession[]) {
  return Math.round(history.reduce((sum, item) => sum + item.durationSeconds, 0) / 60);
}

export interface StatsContext {
  /** Nombre de séances prévues par semaine. */
  weeklyGoal: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  points: number;
  /** Progression actuelle et objectif, pour afficher une barre. */
  progress: (history: CompletedSession[], ctx: StatsContext) => { value: number; target: number };
}

const PUSH_UPS = ['pompes', 'pompes-genoux', 'pompes-mur'];

function sessionsAchievement(target: number, points: number): Achievement {
  return {
    id: `seances-${target}`,
    title: target === 1 ? 'Premier pas' : `${target} séances`,
    description: target === 1 ? 'Termine ta première séance.' : `Termine ${target} séances.`,
    points,
    progress: (history) => ({ value: history.filter((item) => !item.partial).length, target }),
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

function weeksAchievement(target: number, points: number): Achievement {
  return {
    id: `semaines-${target}`,
    title: `${target} semaines réussies`,
    description: `Fais toutes tes séances prévues ${target} semaines de suite.`,
    points,
    progress: (history, ctx) => ({ value: bestWeekStreak(history, ctx.weeklyGoal), target }),
  };
}

export const ACHIEVEMENTS: Achievement[] = [
  sessionsAchievement(1, 10),
  sessionsAchievement(5, 20),
  sessionsAchievement(10, 30),
  sessionsAchievement(25, 50),
  weeksAchievement(1, 15),
  weeksAchievement(4, 40),
  pushUpsAchievement(100, 15),
  pushUpsAchievement(1000, 40),
  pushUpsAchievement(10000, 100),
];

export function isUnlocked(achievement: Achievement, history: CompletedSession[], ctx: StatsContext) {
  const { value, target } = achievement.progress(history, ctx);
  return value >= target;
}

export function unlockedIds(history: CompletedSession[], ctx: StatsContext) {
  return ACHIEVEMENTS.filter((a) => isUnlocked(a, history, ctx)).map((a) => a.id);
}

export function achievementPoints(history: CompletedSession[], ctx: StatsContext) {
  return ACHIEVEMENTS.filter((a) => isUnlocked(a, history, ctx)).reduce((sum, a) => sum + a.points, 0);
}
