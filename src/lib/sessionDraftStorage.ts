import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseSessionDraft, type SessionDraft } from './sessionDraft';

const storageKey = (owner: string) => 'aria-sport/session-draft/v1/' + owner;
// Les écritures et suppressions gardent leur ordre, même si le stockage est lent.
let pending: Promise<void> = Promise.resolve();

export async function readSessionDraft(owner: string) {
  await pending;
  return parseSessionDraft(await AsyncStorage.getItem(storageKey(owner)));
}

export function writeSessionDraft(owner: string, draft: SessionDraft | null) {
  const json = draft ? JSON.stringify(draft) : null;
  const operation = pending.then(() => json === null
    ? AsyncStorage.removeItem(storageKey(owner))
    : AsyncStorage.setItem(storageKey(owner), json));
  pending = operation.catch(() => {});
  return operation;
}

