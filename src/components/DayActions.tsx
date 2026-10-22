import { router } from 'expo-router';
import { useCallback } from 'react';

import { addDays, relativeDay } from '@/lib/date';
import type { ScheduledDay } from '@/lib/schedule';
import { useApp } from '@/store/AppStore';
import { colors } from '@/theme';

import { SheetOption, useActionSheet } from './ActionSheet';

export function askCoach(prompt: string) {
  router.navigate({ pathname: '/coach', params: { prompt } });
}

/** Menu des actions possibles sur une journée du planning. */
export function useDayActions() {
  const { moveDay, skipDay, restoreDay } = useApp();
  const sheet = useActionSheet();

  const open = useCallback(
    (day: ScheduledDay) => {
      const label = relativeDay(day.date).toLowerCase();
      const options: SheetOption[] = [];
      if (day.status === 'planned' || day.status === 'missed') {
        options.push({ label: 'Voir et commencer', icon: 'play', color: colors.accentInk, onPress: () => router.push(`/seance/d-${day.date}`) });
        options.push({ label: 'Décaler au lendemain', icon: 'arrow-redo', onPress: () => moveDay(day.date, addDays(day.date, 1)) });
        options.push({ label: 'Changer de séance', icon: 'swap-horizontal', onPress: () => router.push({ pathname: '/seances', params: { date: day.date } }) });
        options.push({
          label: 'Adapter avec le coach',
          icon: 'sparkles',
          color: colors.violet,
          onPress: () => askCoach(`Adapte ma séance de ${label} (${day.date}) : `),
        });
        options.push({ label: 'Passer cette séance', icon: 'close-circle', destructive: true, onPress: () => skipDay(day.date, 'Séance passée') });
      }
      if (day.status === 'rest') {
        options.push({ label: 'Ajouter une séance ce jour-là', icon: 'add-circle', color: colors.accentInk, onPress: () => router.push({ pathname: '/seances', params: { date: day.date } }) });
      }
      if (day.modified || day.status === 'skipped') {
        options.push({ label: 'Rétablir la séance prévue', icon: 'refresh', onPress: () => restoreDay(day.date) });
      }
      sheet.open(relativeDay(day.date), options);
    },
    [moveDay, skipDay, restoreDay, sheet],
  );

  return { open, element: sheet.element };
}
