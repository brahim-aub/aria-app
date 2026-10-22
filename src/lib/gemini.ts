/**
 * Client de l'API Gemini en JSON structuré.
 * - Connecté à un compte : passage par le relais Supabase (Edge Function « gemini »), la clé reste sur le serveur.
 * - Clé personnelle (Réglages) ou mode local : appel direct à Google.
 * Les modèles sont essayés dans l'ordre : si l'un est saturé ou trop lent, on passe au suivant.
 */
import { supabase } from './supabase';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/** eco : Flash-Lite d'abord (5 fois moins cher) ; quality : Flash d'abord. */
export type AiTier = 'eco' | 'quality';
export type AiKind = 'chat' | 'meal' | 'prices' | 'test';

const MODELS: Record<AiTier, string[]> = {
  eco: ['gemini-3.5-flash-lite', 'gemini-3.7-flash', 'gemini-3.8-flash', 'gemini-flash-latest'],
  quality: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest'],
};

const preferred: Partial<Record<AiTier, string>> = {};

export type GeminiContent = { role: 'user' | 'model'; parts: { text: string }[] };

export class GeminiError extends Error {
  constructor(
    message: string,
    public retryable = true,
  ) {
    super(message);
  }
}

/** Comment appeler Gemini : fourni par le store (useApp().ai). */
export type AiAuth = {
  /** Clé personnelle ou intégrée ; ignorée quand on passe par le relais. */
  apiKey: string;
  /** Clé saisie par l'utilisateur dans les réglages : elle passe avant le relais. */
  personalKey: boolean;
  tier: AiTier;
};

type Options = Partial<AiAuth> & {
  kind: AiKind;
  system: string;
  contents: GeminiContent[];
  schema: object;
  timeoutMs?: number;
  temperature?: number;
};

export type WebSource = { title: string; url: string };
type Raw = { text: string; queries: string[]; sources: WebSource[] };

// ───────── Mesure de la consommation ─────────

export type AiUsageEvent = { kind: AiKind; model: string; tokensIn: number; tokensCached: number; tokensOut: number; searched: boolean };
let usageListener: ((u: AiUsageEvent) => void) | undefined;
/** Branché par le store : chaque appel réussi y est compté. */
export function setUsageListener(fn: ((u: AiUsageEvent) => void) | undefined) {
  usageListener = fn;
}

/**
 * Tarifs de référence en dollars par million de tokens (entrée, sortie), relevés pour l'étude CFO.
 * Les modèles sans tarif relevé sont comptés au prix de Flash (estimation haute).
 */
export const MODEL_PRICES: Record<string, { in: number; out: number }> = {
  'gemini-3.8-flash': { in: 1.5, out: 7.5 },
  'gemini-3.5-flash-lite': { in: 0.3, out: 2.5 },
};
export const FLASH_PRICE = MODEL_PRICES['gemini-3.8-flash'];
/** Recherche Google : gratuite jusqu'à 5 000 requêtes par mois, puis 14 $ les 1 000. */
export const SEARCH_PRICE = 0.014;

export function costOf(u: Pick<AiUsageEvent, 'model' | 'tokensIn' | 'tokensOut'>) {
  const p = MODEL_PRICES[u.model] ?? FLASH_PRICE;
  return (u.tokensIn * p.in + u.tokensOut * p.out) / 1_000_000;
}

// ───────── Transport ─────────

/** Recherche Google refusée (quota ou facturation non activée). */
const NO_SEARCH = 'NO_SEARCH';

type Transport = { url: (model: string) => string; headers: Record<string, string>; wrap: (model: string, body: object) => object };

async function transport(opts: Options): Promise<Transport> {
  const session = supabase && !opts.personalKey ? (await supabase.auth.getSession()).data.session : null;
  if (supabase && session) {
    const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
    return {
      url: () => `${base}/functions/v1/gemini`,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '' },
      wrap: (model, body) => ({ model, kind: opts.kind, body }),
    };
  }
  if (!opts.apiKey) throw new GeminiError('Aucune clé API Gemini configurée. Connecte-toi à ton compte ou ajoute une clé dans Profil → Réglages.', false);
  return {
    url: (model) => `${ENDPOINT}/${model}:generateContent`,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.apiKey },
    wrap: (_model, body) => body,
  };
}

async function callModel(t: Transport, model: string, opts: Options, withThinking: boolean, tools?: object[]): Promise<Raw> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 45000);
  try {
    // Recherche Google, constats du 22/10/2026 :
    // - format JSON imposé : Gemini cherche mais ne renvoie pas la preuve (groundingMetadata), invérifiable ;
    // - réflexion « low » (et Flash-Lite) : réponse de mémoire, sans recherche.
    // Donc : JSON décrit dans les consignes, réponse libre, réflexion par défaut.
    const system = tools
      ? `${opts.system}\n\nUtilise OBLIGATOIREMENT l'outil de recherche Google avant de répondre : une réponse sans recherche est inutilisable.\nRéponds ensuite uniquement par un objet JSON (sans texte autour) conforme à ce schéma :\n${JSON.stringify(opts.schema)}`
      : opts.system;
    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: opts.contents,
      ...(tools ? { tools } : {}),
      generationConfig: {
        ...(tools ? {} : { responseMimeType: 'application/json', responseJsonSchema: opts.schema }),
        temperature: opts.temperature ?? 0.7,
        ...(withThinking && !tools ? { thinkingConfig: { thinkingLevel: 'low' } } : {}),
      },
    };
    const res = await fetch(t.url(model), { method: 'POST', signal: controller.signal, headers: t.headers, body: JSON.stringify(t.wrap(model, body)) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg: string = json?.error?.message ?? `HTTP ${res.status}`;
      // Erreurs du relais (code texte) : quota, pause, connexion… inutile d'essayer un autre modèle.
      if (typeof json?.error?.code === 'string') throw new GeminiError(msg, false);
      if (res.status === 400 && /thinking/i.test(msg)) throw new GeminiError('THINKING', true);
      if (res.status === 400 && /api key/i.test(msg)) throw new GeminiError('Clé API Gemini invalide. Vérifie-la dans les réglages.', false);
      if (res.status === 403) throw new GeminiError('Accès refusé par Gemini : la clé API n’a pas les droits nécessaires.', false);
      if (tools && (res.status === 429 || (res.status === 400 && /tool|search|grounding/i.test(msg)))) throw new GeminiError(NO_SEARCH, false);
      throw new GeminiError(msg, [404, 429, 500, 503, 504].includes(res.status) || /no longer available/i.test(msg));
    }
    const candidate = json?.candidates?.[0];
    const parts: { text?: string; thought?: boolean }[] = candidate?.content?.parts ?? [];
    const text = parts
      .filter((p) => !p.thought && p.text)
      .map((p) => p.text)
      .join('');
    if (!text) throw new GeminiError('Réponse vide', true);
    const meta = candidate?.groundingMetadata;
    const queries: string[] = meta?.webSearchQueries ?? [];
    const u = json?.usageMetadata ?? {};
    usageListener?.({
      kind: opts.kind,
      model,
      tokensIn: u.promptTokenCount ?? 0,
      tokensCached: u.cachedContentTokenCount ?? 0,
      tokensOut: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
      searched: queries.length > 0,
    });
    const sources: WebSource[] = (meta?.groundingChunks ?? [])
      .map((c: { web?: { uri?: string; title?: string } }) => c.web)
      .filter((w: { uri?: string } | undefined): w is { uri: string; title?: string } => !!w?.uri)
      .map((w: { uri: string; title?: string }) => ({ url: w.uri, title: w.title ?? w.uri }));
    return { text, queries, sources };
  } catch (e) {
    if (e instanceof GeminiError) throw e;
    if ((e as Error)?.name === 'AbortError') throw new GeminiError('Délai dépassé', true);
    throw new GeminiError('Pas de connexion internet ?', true);
  } finally {
    clearTimeout(timer);
  }
}

function parseJson<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Réponse libre (recherche Google) : on garde l'objet JSON qu'elle contient.
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('JSON absent');
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  }
}

async function run<T>(opts: Options, tools?: object[]): Promise<{ data: T; raw: Raw }> {
  const tier = opts.tier ?? 'eco';
  const t = await transport(opts);
  const models = MODELS[tier];
  const first = preferred[tier];
  const all = first ? [first, ...models.filter((m) => m !== first)] : models;
  // Recherche Google (payante) : 2 modèles au plus, pour ne pas multiplier les appels facturés en cas d'échec.
  const order = tools ? all.slice(0, 2) : all;
  let lastError: GeminiError | undefined;
  for (const model of order) {
    for (const thinking of [true, false]) {
      try {
        const raw = await callModel(t, model, opts, thinking, tools);
        const data = parseJson<T>(raw.text);
        preferred[tier] = model;
        return { data, raw };
      } catch (e) {
        const err = e instanceof GeminiError ? e : new GeminiError('Réponse illisible', true);
        if (err.message === 'THINKING') continue;
        if (!err.retryable) throw err;
        lastError = err;
        break;
      }
    }
  }
  throw new GeminiError(
    lastError?.message === 'Pas de connexion internet ?'
      ? 'Impossible de joindre le coach. Vérifie ta connexion internet.'
      : /high demand|overloaded|unavailable/i.test(lastError?.message ?? '')
        ? 'Les serveurs de Google Gemini sont saturés en ce moment. Réessaie dans quelques minutes (rien n’est facturé).'
        : 'Le coach est très sollicité en ce moment. Réessaie dans un instant.',
  );
}

export async function generateJSON<T>(opts: Options): Promise<T> {
  return (await run<T>(opts)).data;
}

export type SearchResult<T> = { data: T; sources: WebSource[]; queries: string[] };

export const SEARCH_UNAVAILABLE =
  'La recherche Google n’est pas autorisée avec cette clé Gemini. Active la facturation sur le projet Google AI Studio (aistudio.google.com → Paramètres → Facturation) pour obtenir les prix réels des magasins.';

/**
 * Comme generateJSON, mais Gemini DOIT chercher sur Google (prix réels en ligne).
 * Aucune réponse « de mémoire » : sans recherche effectuée, on renvoie une erreur.
 */
export async function generateJSONWithSearch<T>(opts: Options & { requireSearch?: boolean }): Promise<SearchResult<T>> {
  try {
    const { data, raw } = await run<T>({ ...opts, tier: opts.tier ?? 'quality' }, [{ google_search: {} }]);
    if (opts.requireSearch !== false && !raw.queries.length && !raw.sources.length) throw new GeminiError('Gemini n’a pas effectué de recherche en ligne. Réessaie dans un instant.', false);
    return { data, sources: raw.sources, queries: raw.queries };
  } catch (e) {
    if (e instanceof GeminiError && e.message === NO_SEARCH) throw new GeminiError(SEARCH_UNAVAILABLE, false);
    throw e;
  }
}
