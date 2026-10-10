import type { Profile } from '@/lib/types';

/** Pas de rappels dans le navigateur : ils ne fonctionnent que sur le téléphone. */
export async function syncReminders(_profile: Profile): Promise<boolean> {
  return true;
}

export const remindersSupported = false;
