import * as Haptics from 'expo-haptics';

/** Petit retour tactile sur les actions importantes. */
export function tap() {
  Haptics.selectionAsync().catch(() => {});
}

export function impact() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function success() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
