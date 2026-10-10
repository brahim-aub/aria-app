import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Profile } from '@/lib/types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CHANNEL_ID = 'rappels';

/**
 * Programme un rappel hebdomadaire pour chaque jour d'entraînement, à l'heure choisie.
 * Renvoie false si la personne a refusé les notifications.
 */
export async function syncReminders(profile: Profile): Promise<boolean> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!profile.reminderEnabled || profile.trainingDays.length === 0) return true;

  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Rappels de séance',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  for (const day of profile.trainingDays) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `C'est l'heure de ta séance, ${profile.firstName}`,
        body: `${profile.minutesPerSession} minutes pour toi aujourd'hui. Ta séance est prête.`,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        channelId: CHANNEL_ID,
        // expo-notifications numérote les jours de 1 (dimanche) à 7.
        weekday: day + 1,
        hour: profile.reminderHour,
        minute: 0,
      },
    });
  }
  return true;
}

export const remindersSupported = true;
