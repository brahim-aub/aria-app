import { confirmAction } from './confirm';

/** Texte du consentement au coach IA (données envoyées à Google Gemini). */
export const AI_CONSENT_TEXT =
  'Pour te répondre, le coach envoie ton message et le contexte utile (profil, planning, douleurs signalées, préférences alimentaires) à Google Gemini, qui peut les traiter hors de l’Union européenne. Tu peux retirer ton accord à tout moment dans les réglages.';

/** Demande l'accord s'il manque ; renvoie true si l'IA peut être utilisée. */
export async function ensureAiConsent(consentAt: string | undefined, save: (ok: boolean) => void) {
  if (consentAt) return true;
  const ok = await confirmAction('Utiliser le coach IA ?', AI_CONSENT_TEXT, 'J’accepte');
  if (ok) save(true);
  return ok;
}
