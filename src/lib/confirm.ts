import { Alert, Platform } from 'react-native';

/**
 * Confirmations et messages, sur téléphone comme sur le web.
 * - Téléphone : boîte native (Alert).
 * - Web : boîte dessinée par l'app (DialogHost), car window.confirm / window.alert
 *   sont bloqués par certains navigateurs intégrés et répondent « Annuler » d'eux-mêmes.
 */
export type DialogRequest = {
  title: string;
  message: string;
  /** Absent : simple message avec un bouton « OK ». */
  confirmLabel?: string;
  destructive?: boolean;
  resolve: (ok: boolean) => void;
};

let host: ((req: DialogRequest) => void) | null = null;

/** Branché par <DialogHost /> (app/_layout.tsx). */
export function setDialogHost(fn: ((req: DialogRequest) => void) | null) {
  host = fn;
}

export function confirmAction(title: string, message: string, confirmLabel: string, destructive = false): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (host) return new Promise((resolve) => host!({ title, message, confirmLabel, destructive, resolve }));
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  );
}

/** Message simple, visible aussi sur le web. */
export function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    if (host) host({ title, message, resolve: () => {} });
    else window.alert(`${title}\n\n${message}`);
  } else Alert.alert(title, message);
}
