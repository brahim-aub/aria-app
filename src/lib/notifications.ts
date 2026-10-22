import * as Notifications from 'expo-notifications';
import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';

import type { AppData, Reminders } from '@/store/AppStore';

import { dateKey, parseKey } from './date';
import { getRange } from './schedule';
import { estimateMinutes } from './workout';

const CHANNEL_ID = 'rappels';
/** Les rappels couvrent les deux prochaines semaines ; ils sont reprogrammés à chaque changement du planning. */
const HORIZON_DAYS = 14;
const supported = Platform.OS !== 'web';

const MESSAGES = [
  'C’est l’heure de ta séance 💪',
  'Ta séance t’attend. Un petit effort aujourd’hui, une grande fierté demain.',
  'On bouge ? Ta reprise avance une séance à la fois.',
];

export function setupNotificationHandler() {
  if (!supported) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function createChannel() {
  if (Platform.OS !== 'android') return;
  // Android 13+ n'affiche la demande de permission qu'après la création d'un canal.
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Rappels de séance',
    // eslint-disable-next-line import/namespace -- réexporté via `export *` depuis un .d.ts, que le plugin import ne suit pas
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/** Demande la permission (uniquement sur action de l'utilisateur). */
export async function requestReminderPermission() {
  if (!supported) return false;
  await createChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Séances prévues à venir, à l'heure du rappel. */
function upcoming(data: AppData, reminders: Reminders) {
  const now = Date.now();
  return getRange(data, dateKey(), HORIZON_DAYS)
    .filter((d) => d.status === 'planned' && d.session)
    .map((d) => {
      const at = parseKey(d.date);
      at.setHours(reminders.hour, reminders.minute, 0, 0);
      return { at, title: d.session!.title, minutes: estimateMinutes(d.session!) };
    })
    .filter((r) => r.at.getTime() > now);
}

/**
 * Reprogramme les rappels : un par séance prévue, à l'heure choisie.
 * Ne demande jamais la permission : sans elle, il ne se passe rien.
 */
export async function syncReminders(data: AppData, active: boolean) {
  if (!supported) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const { reminders } = data;
  if (!active || !reminders.enabled) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  await createChannel();
  await Promise.all(
    upcoming(data, reminders).map((r, i) =>
      Notifications.scheduleNotificationAsync({
        content: { title: `${r.title} · ~${r.minutes} min`, body: MESSAGES[i % MESSAGES.length] },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: CHANNEL_ID },
      }),
    ),
  );
}

/** Garde les rappels alignés sur le planning (séances décalées, remplacées, nouveau téléphone…). */
export function useReminderSync(data: AppData, active: boolean) {
  const signature = useMemo(() => {
    if (!active || !data.reminders.enabled) return 'off';
    const r = data.reminders;
    return `${r.hour}:${r.minute}|${upcoming(data, r)
      .map((u) => `${u.at.toISOString()}=${u.title}`)
      .join(',')}`;
  }, [data, active]);

  useEffect(() => {
    // Les données sont lues au moment du changement de signature.
    syncReminders(data, active).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
}
