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

  // 2. Requête.
  let input: { model?: string; kind?: string; body?: Record<string, unknown> };
  try {
    input = await req.json();
  } catch {
    return fail(400, 'Requête illisible');
  }
  const model = String(input.model ?? '');
  const kind = String(input.kind ?? '');
  const body = input.body;
  if (!MODELS.has(model) || !KINDS.has(kind) || !body || typeof body !== 'object') return fail(400, 'Requête invalide');
  // La recherche Google (payante) n'est permise que pour les prix.
  if (kind !== 'prices') delete body.tools;

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
  const text = await res.text();

  // Échec côté Google (modèle indisponible, recherche refusée…) : l'appel ne compte pas dans le quota du jour.
  if (!res.ok) await admin.rpc('ai_refund_quota', { p_user: user.id, p_kind: kind });

  // 5. Consommation réelle (tokens et recherches Google).
  try {
    const json = JSON.parse(text);
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

  // Réponse de Google transmise telle quelle (elle ne contient jamais la clé).
  return new Response(text, { status: res.status, headers: { ...cors, 'Content-Type': 'application/json' } });
});
