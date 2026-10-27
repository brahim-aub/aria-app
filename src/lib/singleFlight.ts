/** Mutualise uniquement les opérations simultanées ; aucun résultat ni secret n'est conservé après règlement. */
export function singleFlight<T>() {
  const pending = new Map<string, Promise<T>>();
  return (key: string, work: () => Promise<T>): Promise<T> => {
    const existing = pending.get(key);
    if (existing) return existing;
    const task = Promise.resolve().then(work).finally(() => { if (pending.get(key) === task) pending.delete(key); });
    pending.set(key, task);
    return task;
  };
}
