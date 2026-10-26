/**
 * Sérialise les écritures pour que la dernière sauvegarde reflète l'état courant.
 * Une ancienne réponse ne peut pas masquer l'échec d'une sauvegarde plus récente.
 */
export function createLocalSaver(write: (payload: string) => Promise<void>, reportFailure: (failed: boolean) => void) {
  let pending: Promise<void> = Promise.resolve();
  let latest = 0;
  return (payload: string): Promise<void> => {
    const version = ++latest;
    const operation = pending.then(() => write(payload));
    pending = operation.catch(() => {});
    return operation.then(
      () => { if (version === latest) reportFailure(false); },
      () => { if (version === latest) reportFailure(true); },
    );
  };
}

