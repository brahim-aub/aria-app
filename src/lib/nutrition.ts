import type { Profile } from '@/lib/types';

export interface NutritionTargets {
  /** Métabolisme de base (formule de Mifflin-St Jeor), en kcal. */
  bmr: number;
  maintenance: number;
  target: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export function computeNutrition(profile: Profile): NutritionTargets {
  const { weightKg, heightCm, age, sex, daysPerWeek, goal } = profile;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'homme' ? 5 : -161);
  const activity = daysPerWeek >= 4 ? 1.55 : 1.375;
  const maintenance = bmr * activity;

  let target = maintenance;
  if (goal === 'perte_poids') target = Math.max(bmr, maintenance * 0.85);
  if (goal === 'muscle') target = maintenance * 1.1;

  const proteinG = weightKg * (goal === 'muscle' ? 2 : 1.6);
  const fatG = (target * 0.25) / 9;
  const carbsG = Math.max(0, (target - proteinG * 4 - fatG * 9) / 4);

  return {
    bmr: Math.round(bmr),
    maintenance: Math.round(maintenance),
    target: Math.round(target),
    proteinG: Math.round(proteinG),
    fatG: Math.round(fatG),
    carbsG: Math.round(carbsG),
  };
}
