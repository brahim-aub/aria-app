import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import type { SessionDraft } from '@/lib/sessionDraft';
import { readSessionDraft, writeSessionDraft } from '@/lib/sessionDraftStorage';
import { useAuth } from './AuthStore';

type DraftStore = {
  draft: SessionDraft | null;
  ready: boolean;
  error: string | null;
  saveDraft: (draft: SessionDraft) => void;
  discardDraft: () => Promise<void>;
};
const Context = createContext<DraftStore | null>(null);

export function SessionDraftProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const owner = auth.session?.user.id ?? (auth.enabled ? null : 'local');
  return <DraftStorage key={owner ?? 'signed-out'} owner={owner}>{children}</DraftStorage>;
}

function DraftStorage({ children, owner }: { children: ReactNode; owner: string | null }) {
  const [draft, setDraft] = useState<SessionDraft | null>(null);
  const [ready, setReady] = useState(!owner);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!owner) return;
    let active = true;
    readSessionDraft(owner).then((saved) => {
      if (active) setDraft(saved);
    }).catch(() => {
      if (active) setError('Impossible de lire la sauvegarde de ta séance sur cet appareil.');
    }).finally(() => {
      if (active) setReady(true);
    });
    return () => { active = false; };
  }, [owner]);

  const saveDraft = useCallback((next: SessionDraft) => {
    if (!owner) return;
    setDraft(next);
    void writeSessionDraft(owner, next).then(() => setError(null)).catch(() => {
      setError('La séance ne peut pas être sauvegardée sur cet appareil. Garde l’application ouverte.');
    });
  }, [owner]);

  const discardDraft = useCallback(async () => {
    if (owner) await writeSessionDraft(owner, null);
    setDraft(null);
    setError(null);
  }, [owner]);

  return <Context.Provider value={{ draft, ready, error, saveDraft, discardDraft }}>{children}</Context.Provider>;
}

export function useSessionDraft() {
  const context = useContext(Context);
  if (!context) throw new Error('SessionDraftProvider manquant');
  return context;
}

