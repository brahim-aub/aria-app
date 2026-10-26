export type LocalLoadResult<T> = { ready: true; data: T | null } | { ready: false };

/** Une lecture vide est normale ; une erreur laisse impérativement l'application non prête. */
export async function readLocalSnapshot<T>(read: () => Promise<T | null>): Promise<LocalLoadResult<T>> {
  try {
    return { ready: true, data: await read() };
  } catch {
    return { ready: false };
  }
}

export function decodeLocalObject(raw: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Sauvegarde locale illisible');
  return parsed as Record<string, unknown>;
}

