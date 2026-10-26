// Relais Gemini d'Aria Sport (Supabase Edge Function « gemini »).
// - La clé Gemini reste ici (secret GEMINI_API_KEY), elle n'est plus dans l'app.
// - Seuls les utilisateurs connectés peuvent l'appeler.
// - Quotas par jour et interrupteurs modifiables dans la table app_config, sans republier l'app.
// - Les tokens consommés sont enregistrés dans ai_usage pour connaître le vrai coût.
import { createClient } from 'npm:@supabase/supabase-js@2';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODELS = new Set(['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest']);
const KINDS = new Set(['chat', 'meal', 'prices', 'test']);
const DEFAULT_LIMITS: Record<string, number> = { chat: 60, meal: 4, prices: 60, test: 10 };

// Plafonds côté serveur : les paramètres du client ne peuvent pas les relever.
const MAX_REQUEST_BYTES = 256 * 1024;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const OUTPUT_TOKENS: Record<string, number> = { chat: 8192, meal: 24576, prices: 4096, test: 1024 };
const MAX_MESSAGES = 32;
const MAX_PARTS = 8;

class PayloadLimitError extends Error {
  constructor(message: string, public status = 413, public code = 'REQUEST_LIMIT') {
    super(message);
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Compter les octets réellement reçus, même sans Content-Length ou avec un en-tête faux. */
async function readBoundedText(stream: ReadableStream<Uint8Array> | null, maxBytes: number, response = false): Promise<string> {
  if (!stream) return '';
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const parts: string[] = [];
  let received = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new PayloadLimitError(
          response ? 'La réponse du coach est trop volumineuse. Essaie une demande plus ciblée.' : 'La demande est trop volumineuse. Raccourcis la conversation ou ta demande.',
          response ? 502 : 413,
          response ? 'RESPONSE_LIMIT' : 'REQUEST_LIMIT',
        );
      }
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    return parts.join('');
  } finally {
    reader.releaseLock();
  }
}

function textParts(value: unknown): { text: string }[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_PARTS)
    throw new PayloadLimitError('Nombre de parties du message non autorisé.');
  return value.map((part) => {
    if (!isObject(part) || typeof part.text !== 'string' || Object.keys(part).some((key) => key !== 'text'))
      throw new PayloadLimitError('Seuls les messages texte sont autorisés.', 400, 'INVALID_REQUEST');
    return { text: part.text };
  });
}

function boundedBody(raw: Record<string, unknown>, kind: string): Record<string, unknown> {
  if (!Array.isArray(raw.contents) || !raw.contents.length || raw.contents.length > MAX_MESSAGES)
    throw new PayloadLimitError('La conversation est trop longue. Raccourcis ta demande.');
  const contents = raw.contents.map((content) => {
    if (!isObject(content) || (content.role !== undefined && content.role !== 'user' && content.role !== 'model'))
      throw new PayloadLimitError('Message invalide.', 400, 'INVALID_REQUEST');
    return { role: content.role ?? 'user', parts: textParts(content.parts) };
  });
  const config = raw.generationConfig === undefined ? {} : raw.generationConfig;
  if (!isObject(config)) throw new PayloadLimitError('Paramètres de génération invalides.', 400, 'INVALID_REQUEST');
  const requested = config.maxOutputTokens;
  if (requested !== undefined && (typeof requested !== 'number' || !Number.isSafeInteger(requested) || requested < 1))
    throw new PayloadLimitError('Limite de réponse invalide.', 400, 'INVALID_REQUEST');
  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: Math.min(typeof requested === 'number' ? requested : OUTPUT_TOKENS[kind], OUTPUT_TOKENS[kind]),
    candidateCount: 1,
  };
  // Liste autorisée : pas de sortie image/audio, de cache distant ou de paramètre alternatif contournant les plafonds.
  if (config.temperature !== undefined) {
    if (typeof config.temperature !== 'number' || !Number.isFinite(config.temperature) || config.temperature < 0 || config.temperature > 2)
      throw new PayloadLimitError('Température invalide.', 400, 'INVALID_REQUEST');
    generationConfig.temperature = config.temperature;
  }
  if (config.responseMimeType !== undefined) {
    if (!['application/json', 'text/plain'].includes(String(config.responseMimeType)))
      throw new PayloadLimitError('Format de réponse non autorisé.', 400, 'INVALID_REQUEST');
    generationConfig.responseMimeType = config.responseMimeType;
  }
  if (config.responseJsonSchema !== undefined) {
    if (!isObject(config.responseJsonSchema))
      throw new PayloadLimitError('Schéma de réponse invalide.', 400, 'INVALID_REQUEST');
    generationConfig.responseJsonSchema = config.responseJsonSchema;
  }
  if (config.thinkingConfig !== undefined) {
    if (!isObject(config.thinkingConfig) || !['minimal', 'low', 'medium', 'high'].includes(String(config.thinkingConfig.thinkingLevel)))
      throw new PayloadLimitError('Paramètres de réflexion invalides.', 400, 'INVALID_REQUEST');
    generationConfig.thinkingConfig = { thinkingLevel: config.thinkingConfig.thinkingLevel };
  }
  const body: Record<string, unknown> = { contents, generationConfig };
  if (raw.systemInstruction !== undefined) {
    if (!isObject(raw.systemInstruction))
      throw new PayloadLimitError('Instructions invalides.', 400, 'INVALID_REQUEST');
    body.systemInstruction = { parts: textParts(raw.systemInstruction.parts) };
  }
  if (kind === 'prices' && raw.tools !== undefined) {
    if (!Array.isArray(raw.tools) || raw.tools.length !== 1 || !isObject(raw.tools[0]) ||
      Object.keys(raw.tools[0]).length !== 1 || !isObject(raw.tools[0].google_search))
      throw new PayloadLimitError('Outil de recherche non autorisé.', 400, 'INVALID_REQUEST');
    body.tools = [{ google_search: {} }];
  }
  return body;
}


const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const fail = (status: number, message: string, code?: string) => reply(status, { error: { message, code } });

function secretKey() {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
    const first = keys.default ?? Object.values(keys)[0];
    if (first) return String(first);
  } catch {
    // ancien format ci-dessous
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

const admin = createClient(Deno.env.get('SUPABASE_URL')!, secretKey(), { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail(405, 'Méthode non autorisée');

  // 1. Utilisateur connecté obligatoire.
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } };
  const user = auth?.user;
  if (!user) return fail(401, 'Connecte-toi pour utiliser le coach.', 'AUTH');

  // 2. Taille et contenu vérifiés avant la prise de quota.
  let input: Record<string, unknown>;
  try {
    const announced = Number(req.headers.get('Content-Length') ?? '0');
    if (announced > MAX_REQUEST_BYTES) throw new PayloadLimitError('La demande est trop volumineuse.');
    const parsed: unknown = JSON.parse(await readBoundedText(req.body, MAX_REQUEST_BYTES));
    if (!isObject(parsed)) return fail(400, 'Requête invalide', 'INVALID_REQUEST');
    input = parsed;
  } catch (error) {
    if (error instanceof PayloadLimitError) return fail(error.status, error.message, error.code);
    return fail(400, 'Requête illisible', 'INVALID_REQUEST');
  }
  const model = String(input.model ?? '');
  const kind = String(input.kind ?? '');
  if (!MODELS.has(model) || !KINDS.has(kind) || !isObject(input.body))
    return fail(400, 'Requête invalide', 'INVALID_REQUEST');
  let body: Record<string, unknown>;
  try {
    body = boundedBody(input.body, kind);
  } catch (error) {
    if (error instanceof PayloadLimitError) return fail(error.status, error.message, error.code);
    return fail(400, 'Requête invalide', 'INVALID_REQUEST');
  }

  // 3. Interrupteurs et quotas (table app_config, clé « ai »).
  const { data: cfgRow } = await admin.from('app_config').select('value').eq('key', 'ai').maybeSingle();
  const cfg = (cfgRow?.value ?? {}) as { enabled?: boolean; prices_enabled?: boolean; daily_limits?: Record<string, number>; admin_emails?: string[] };
  if (cfg.enabled === false) return fail(503, 'Le coach est en pause pour maintenance. Réessaie plus tard.', 'DISABLED');
  if (kind === 'prices' && cfg.prices_enabled === false) return fail(503, 'La recherche de prix est momentanément désactivée.', 'DISABLED');
  // Comptes admin (cle admin_emails dans app_config) : pas de quota, pour tester sans limite.
  const isAdmin = !!user.email && (cfg.admin_emails ?? []).some((e) => e.toLowerCase() === user.email!.toLowerCase());
  const limit = isAdmin ? 1_000_000 : cfg.daily_limits?.[kind] ?? DEFAULT_LIMITS[kind];
  const { data: allowed, error: quotaError } = await admin.rpc('ai_take_quota', { p_user: user.id, p_kind: kind, p_limit: limit });
  if (quotaError) return fail(500, 'Quota indisponible');
  if (!allowed) return fail(429, 'Limite du jour atteinte pour cette fonction. Elle revient demain.', 'QUOTA');

  // 4. Appel Gemini avec la clé du serveur.
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return fail(503, 'Le coach n’est pas encore configuré sur le serveur (clé Gemini manquante).', 'NO_KEY');
  const res = await fetch(`${GEMINI}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  });
  let text: string;
  try {
    text = await readBoundedText(res.body, MAX_RESPONSE_BYTES, true);
  } catch (error) {
    if (error instanceof PayloadLimitError) return fail(error.status, error.message, error.code);
    return fail(502, 'La réponse du coach est illisible.', 'INVALID_RESPONSE');
  }

  // Échec côté Google (modèle indisponible, recherche refusée…) : l'appel ne compte pas dans le quota du jour.
  if (!res.ok) await admin.rpc('ai_refund_quota', { p_user: user.id, p_kind: kind });

  // 5. Consommation réelle (tokens et recherches Google).
  let outputLimited = false;
  try {
    const json = JSON.parse(text);
    outputLimited = res.ok && (json?.candidates ?? []).some((candidate: { finishReason?: string }) => candidate.finishReason === 'MAX_TOKENS');
    const u = json?.usageMetadata ?? {};
    const searches = json?.candidates?.[0]?.groundingMetadata?.webSearchQueries?.length ? 1 : 0;
    await admin.rpc('ai_add_usage', {
      p_user: user.id,
      p_kind: kind,
      p_in: u.promptTokenCount ?? 0,
      p_out: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
      p_searches: searches,
    });
  } catch {
    // réponse non JSON : rien à compter
  }

  // Une réponse tronquée n'est pas renvoyée comme un JSON valide ni relancée sur d'autres modèles.
  if (outputLimited) return fail(502, 'La réponse atteint la longueur maximale autorisée. Essaie une demande plus ciblée.', 'OUTPUT_LIMIT');

  // Réponse de Google transmise telle quelle (elle ne contient jamais la clé).
  return new Response(text, { status: res.status, headers: { ...cors, 'Content-Type': 'application/json' } });
});
