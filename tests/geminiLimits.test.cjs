const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../supabase/functions/gemini/index.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;

function server({ authenticated = true, upstream, optimizations = false, claimState = null, lockError = false } = {}) {
  let handler;
  const requests = [];
  const rpcs = [];
  const locks = new Map();
  const usage = [];
  const admin = {
    auth: { getUser: async (jwt) => ({ data: { user: authenticated ? { id: jwt === 'second-user' ? 'other-test' : 'test', email: 'test@example.invalid' } : null } }) },
    from: () => ({ insert: async (entry) => { usage.push(entry); return { error: null }; }, select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: optimizations ? { value: { optimizations_enabled: true } } : null }) }) }) }),
    rpc: async (name, args) => {
      rpcs.push({ name, args });
      if (name === 'ai_claim_request') {
        if (lockError) return { error: { message: 'database unavailable' } };
        if (claimState) return { data: claimState };
        const key = args.p_user + args.p_hash;
        if (locks.has(key)) return { data: locks.get(key) };
        locks.set(key, { state: 'pending' });
        return { data: { state: 'acquired' } };
      }
      if (name === 'ai_finish_request') locks.set(args.p_user + args.p_hash, { state: 'complete', text: args.p_text, status: args.p_status });
      return { data: true, error: null };
    },
  };
  const module = { exports: {} };
  vm.runInNewContext('(function(require,module,exports){' + compiled + '\n})', {
    Request, Response, ReadableStream, TextDecoder, TextEncoder, AbortSignal, crypto: require('node:crypto').webcrypto,
    Deno: {
      env: { get: (name) => ({ SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-secret', GEMINI_API_KEY: 'test-google' })[name] },
      serve: (callback) => { handler = callback; },
    },
    fetch: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      return upstream ? upstream() : new Response(JSON.stringify({
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{}' }] } }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
      }), { status: 200 });
    },
  })((id) => {
    assert.equal(id, 'npm:@supabase/supabase-js@2');
    return { createClient: () => admin };
  }, module, module.exports);
  return { handler, requests, rpcs, usage };
}
const payload = (kind = 'chat', config = {}) => ({
  kind, model: 'gemini-3.8-flash',
  body: {
    contents: [{ role: 'user', parts: [{ text: 'Test' }] }],
    systemInstruction: { parts: [{ text: 'Réponds en JSON.' }] },
    generationConfig: { temperature: 0.7, responseMimeType: 'application/json',
      responseJsonSchema: { type: 'object' }, thinkingConfig: { thinkingLevel: 'low' }, ...config },
  },
});
const request = (data, headers = {}) => new Request('https://test.invalid/gemini', {
  method: 'POST', headers: { Authorization: 'Bearer test-user', 'Content-Type': 'application/json', ...headers },
  body: typeof data === 'string' ? data : JSON.stringify(data),
});

test('chaque usage possède son plafond serveur, même si le client demande davantage', async () => {
  for (const [kind, cap] of Object.entries({ chat: 8192, meal: 24576, prices: 4096, test: 1024 })) {
    const s = server();
    const result = await s.handler(request(payload(kind, { maxOutputTokens: 1000000, candidateCount: 64 })));
    assert.equal(result.status, 200);
    const config = s.requests[0].body.generationConfig;
    assert.equal(config.maxOutputTokens, cap, kind);
    assert.equal(config.candidateCount, 1, kind);
    assert.equal(config.responseMimeType, 'application/json');
    assert.equal(config.thinkingConfig.thinkingLevel, 'low');
    assert.equal(s.rpcs.filter((r) => r.name === 'ai_take_quota').length, 1);
  }
});

test('une limite client plus basse est conservée et le défaut serveur s’applique sinon', async () => {
  const a = server();
  await a.handler(request(payload('chat', { maxOutputTokens: 100 })));
  assert.equal(a.requests[0].body.generationConfig.maxOutputTokens, 100);
  const b = server();
  await b.handler(request(payload('meal')));
  assert.equal(b.requests[0].body.generationConfig.maxOutputTokens, 24576);
});

test('une requête annoncée trop volumineuse est refusée sans quota ni appel Gemini', async () => {
  const s = server();
  const result = await s.handler(request(payload(), { 'Content-Length': String(256 * 1024 + 1) }));
  assert.equal(result.status, 413);
  assert.equal((await result.json()).error.code, 'REQUEST_LIMIT');
  assert.equal(s.rpcs.length, 0);
  assert.equal(s.requests.length, 0);
});

test('les octets UTF-8 réels sont limités même sans taille annoncée ou avec une taille mensongère', async () => {
  for (const headers of [{}, { 'Content-Length': '1' }]) {
    const s = server();
    const input = payload();
    input.body.contents[0].parts[0].text = 'é'.repeat(140000);
    const result = await s.handler(request(input, headers));
    assert.equal(result.status, 413);
    assert.equal(s.rpcs.length, 0);
    assert.equal(s.requests.length, 0);
  }
});

test('les conversations trop longues sont refusées avant toute consommation de quota', async () => {
  const s = server();
  const input = payload();
  input.body.contents = Array.from({ length: 33 }, () => ({ role: 'user', parts: [{ text: 'test' }] }));
  assert.equal((await s.handler(request(input))).status, 413);
  assert.equal(s.rpcs.length, 0);
});

test('les corps incorrects et limites de sortie invalides sont rejetés avant le quota', async () => {
  for (const data of ['{', 'null', '[]', { ...payload(), body: [] },
    payload('chat', { maxOutputTokens: 0 }), payload('chat', { maxOutputTokens: '999999' })]) {
    const s = server();
    assert.equal((await s.handler(request(data))).status, 400);
    assert.equal(s.rpcs.length, 0);
  }
});

test('les références multimédias et outils non autorisés ne contournent pas les limites', async () => {
  const media = payload();
  media.body.contents[0].parts = [{ fileData: { fileUri: 'https://example.invalid/huge-file' } }];
  const a = server();
  assert.equal((await a.handler(request(media))).status, 400);
  assert.equal(a.rpcs.length, 0);
  const search = payload('prices');
  search.body.tools = [{ codeExecution: {} }];
  const b = server();
  assert.equal((await b.handler(request(search))).status, 400);
  assert.equal(b.rpcs.length, 0);
});

test('les paramètres alternatifs de taille, cache ou sortie ne sont pas transmis', async () => {
  const s = server();
  const input = payload('chat', { responseModalities: ['IMAGE'], max_output_tokens: 1000000 });
  input.body.cachedContent = 'cachedContents/huge';
  input.body.generation_config = { max_output_tokens: 1000000 };
  input.body.tools = [{ google_search: {} }];
  await s.handler(request(input));
  const body = s.requests[0].body;
  assert.equal(body.cachedContent, undefined);
  assert.equal(body.generation_config, undefined);
  assert.equal(body.generationConfig.responseModalities, undefined);
  assert.equal(body.tools, undefined);
  assert.equal(body.generationConfig.maxOutputTokens, 8192);
});

test('la recherche Google prévue pour les prix reste disponible', async () => {
  const s = server();
  const input = payload('prices');
  input.body.tools = [{ google_search: {} }];
  assert.equal((await s.handler(request(input))).status, 200);
  assert.deepEqual(s.requests[0].body.tools, [{ google_search: {} }]);
});

test('une réponse tronquée donne une erreur explicite après comptage de la consommation', async () => {
  const s = server({ upstream: () => new Response(JSON.stringify({
    candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"incomplet":' }] } }],
    usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 20 },
  })) });
  const response = await s.handler(request(payload()));
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error.code, 'OUTPUT_LIMIT');
  assert.equal(s.rpcs.filter((r) => r.name === 'ai_add_usage').length, 1);
  assert.equal(s.rpcs.filter((r) => r.name === 'ai_refund_quota').length, 0);
});

test('le corps de réponse est également borné en octets', async () => {
  const s = server({ upstream: () => new Response('x'.repeat(2 * 1024 * 1024 + 1)) });
  const response = await s.handler(request(payload()));
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error.code, 'RESPONSE_LIMIT');
});

test('authentification et prévol CORS restent opérationnels', async () => {
  const s = server({ authenticated: false });
  assert.equal((await s.handler(request(payload()))).status, 401);
  assert.equal(s.rpcs.length, 0);
  assert.equal((await s.handler(new Request('https://test.invalid', { method: 'OPTIONS' }))).status, 200);
});



test('deux appels identiques en cours : une seule génération et une seule prise de quota', async () => {
  let release; let entered;
  const started = new Promise(r => { entered = r; });
  const wait = new Promise(r => { release = r; });
  const s = server({ optimizations: true, upstream: async () => { entered(); await wait; return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{}' }] } }], usageMetadata: { promptTokenCount: 100, cachedContentTokenCount: 60, thoughtsTokenCount: 5, candidatesTokenCount: 10 } })); } });
  const first = s.handler(request(payload())); await started;
  const duplicate = await s.handler(request(payload()));
  assert.equal(duplicate.status, 409); assert.equal((await duplicate.json()).error.code, 'REQUEST_PENDING');
  release(); assert.equal((await first).status, 200);
  const replay = await s.handler(request(payload()));
  assert.equal(replay.status, 200); assert.equal(replay.headers.get('x-ai-replayed'), '1');
  assert.equal(s.requests.length, 1); assert.equal(s.rpcs.filter(r => r.name === 'ai_take_quota').length, 1);
  assert.equal(s.usage[0].tokens_cached, 60); assert.equal(s.usage[0].tokens_thinking, 5); assert.equal(s.usage[0].tokens_out, 15);
});
test('un verrou indisponible ne déclenche aucun appel payant', async () => {
  const s = server({ optimizations: true, lockError: true });
  const result = await s.handler(request(payload()));
  assert.equal(result.status, 503); assert.equal(s.requests.length, 0);
});
test('les recherches sont comptées par requête, et non comme un booléen', async () => {
  const s = server({ optimizations: true, upstream: () => new Response(JSON.stringify({ candidates: [{ groundingMetadata: { webSearchQueries: ['riz', 'lait', 'oeufs'] }, content: { parts: [{ text: '{}' }] } }] })) });
  await s.handler(request(payload('prices')));
  assert.equal(s.rpcs.find(r => r.name === 'ai_add_usage').args.p_searches, 3);
  assert.equal(s.usage[0].search_queries, 3);
});
test('un échec amont est mémorisé brièvement sans nouvelle génération ni nouveau quota', async () => {
  const s = server({ optimizations: true, upstream: () => new Response('{"error":{"message":"unavailable"}}', { status: 503 }) });
  assert.equal((await s.handler(request(payload()))).status, 503);
  assert.equal((await s.handler(request(payload()))).status, 503);
  assert.equal(s.requests.length, 1);
});


test('deux comptes ne reçoivent jamais la réponse personnalisée de l’autre', async () => {
  const s = server({ optimizations: true });
  assert.equal((await s.handler(request(payload()))).status, 200);
  const other = await s.handler(request(payload(), { Authorization: 'Bearer second-user' }));
  assert.equal(other.status, 200); assert.equal(other.headers.get('x-ai-replayed'), null);
  assert.equal(s.requests.length, 2);
});
