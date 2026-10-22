import type { AppData, Diet, Profile } from '@/store/types';

import { dateKey } from './date';
import { getRange } from './schedule';
import { estimateKcal } from './workout';

const JOB_FACTOR = { assis: 1.25, debout: 1.45, physique: 1.65 } as const;

export const JOB_LABEL = { assis: 'Plutôt assis (bureau)', debout: 'Souvent debout / en mouvement', physique: 'Travail physique' } as const;

export const DIET_LABEL: Record<Diet, string> = {
  omnivore: 'Je mange de tout',
  vegetarien: 'Végétarien',
  vegan: 'Vegan',
  pescetarien: 'Pescétarien',
  sans_porc: 'Sans porc',
};

/** Métabolisme de base (Mifflin-St Jeor). */
export function bmr(p: Pick<Profile, 'sex' | 'weightKg' | 'heightCm' | 'age'>) {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return Math.round(base + (p.sex === 'homme' ? 5 : p.sex === 'femme' ? -161 : -78));
}

export type EnergyTargets = {
  bmr: number;
  daily: number;
  trainingPerDay: number;
  target: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  weeklyTrainingKcal: number;
};

/** Besoins quotidiens : métabolisme × activité du quotidien + sport programmé sur les 7 prochains jours, ajusté selon l'objectif. */
export function energyTargets(data: AppData): EnergyTargets {
  const p = data.profile;
  const base = bmr(p);
  const daily = base * JOB_FACTOR[p.job];
  const week = getRange(data, dateKey(), 7);
  const weeklyTrainingKcal = week.reduce((sum, d) => sum + (d.session && d.status !== 'skipped' ? estimateKcal(d.session, p.weightKg) : 0), 0);
  const trainingPerDay = weeklyTrainingKcal / 7;
  const maintenance = daily + trainingPerDay;
  const adj = { perte: -0.17, muscle: 0.1, force: 0.07, forme: 0, endurance: 0.03, sante: 0 }[p.goal];
  const target = Math.round(Math.max(base * 1.1, maintenance * (1 + adj)) / 10) * 10;
  const proteinPerKg = { perte: 2, muscle: 1.8, force: 1.8, forme: 1.5, endurance: 1.5, sante: 1.3 }[p.goal];
  const proteinG = Math.round(p.weightKg * proteinPerKg);
  const fatG = Math.round((target * 0.28) / 9);
  const carbsG = Math.max(0, Math.round((target - proteinG * 4 - fatG * 9) / 4));
  return { bmr: base, daily: Math.round(daily), trainingPerDay: Math.round(trainingPerDay), target, proteinG, fatG, carbsG, weeklyTrainingKcal };
}

export function bmi(p: Pick<Profile, 'weightKg' | 'heightCm'>) {
  const m = p.heightCm / 100;
  return m > 0 ? p.weightKg / (m * m) : 0;
}
