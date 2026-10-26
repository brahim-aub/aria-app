import type { AppData, ChatMessage, UndoSnapshot } from '@/store/types';

const KEYS: (keyof UndoSnapshot)[] = ['profile', 'plan', 'overrides', 'limitations', 'nutrition', 'customSessions'];

/** La réorganisation des clés JSON par le cloud ne constitue pas une modification. */
function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) || Array.isArray(b))
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => same(v, b[i]));
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left).filter((key) => left[key] !== undefined);
  const other = Object.keys(right).filter((key) => right[key] !== undefined);
  return keys.length === other.length && keys.every((key) => Object.hasOwn(right, key) && same(left[key], right[key]));
}

function comparable(key: keyof UndoSnapshot, value: UndoSnapshot[keyof UndoSnapshot]) {
  if (key !== 'nutrition') return value;
  const nutrition = value as UndoSnapshot['nutrition'];
  return { prefs: nutrition.prefs, prefsSet: nutrition.prefsSet };
}

/** null : refus de l'annulation ; sinon, seules les données modifiées par le coach sont restaurées. */
export function getCoachUndoPatch(data: AppData, message: Pick<ChatMessage, 'undo' | 'undoAfter'>): Partial<UndoSnapshot> | null {
  const before = message.undo;
  const after = message.undoAfter;
  if (!before || !after) return null;
  const patch: Partial<UndoSnapshot> = {};
  let changed = false;
  for (const key of KEYS) {
    const previous = comparable(key, before[key]);
    const expected = comparable(key, after[key]);
    if (same(previous, expected)) continue;
    if (!same(comparable(key, data[key]), expected)) return null;
    changed = true;
    if (key === 'nutrition') {
      patch.nutrition = { ...data.nutrition, prefs: before.nutrition.prefs, prefsSet: before.nutrition.prefsSet };
    } else Object.assign(patch, { [key]: before[key] });
  }
  return changed ? patch : null;
}

