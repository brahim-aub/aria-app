const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadModule(name, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib', name + '.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext('(function(require,module,exports){' + code + '\n})')(
    (id) => { if (!(id in imports)) throw new Error('Unexpected import: ' + id); return imports[id]; },
    module, module.exports);
  return module.exports;
}
const helpers = loadModule('sessionDraft');
const sample = () => ({
  version: 1, routeId: 'd-2026-10-26',
  resolved: { session: { id: 'plan-0', title: 'Audit', exercises: [], warmup: true, cooldown: true, source: 'plan' }, kicker: 'Aujourd’hui', notes: [] },
  steps: [
    { type: 'work', exerciseId: 'squat', mode: 'reps', amount: 12, phase: 'main' },
    { type: 'rest', seconds: 45, label: 'Repos' },
  ],
  phase: 'running', index: 1, remainingMs: 12000, elapsedMs: 93000,
  results: { 0: { reps: 11, weightKg: 7.5 } }, draftReps: 11, draftWeight: 7.5,
  difficulty: 3, energy: 4, note: 'À conserver',
});

test('reprise après une longue interruption : séries, charge et temps conservés', () => {
  const saved = helpers.parseSessionDraft(JSON.stringify(sample()));
  assert.equal(saved.results[0].reps, 11);
  assert.equal(saved.results[0].weightKg, 7.5);
  const later = Date.UTC(2026, 10, 1);
  const clock = helpers.resumeSessionClock(saved, later);
  assert.equal(later - clock.startedAt, 93000);
  assert.equal(clock.pausedLeft, 12000);
});

test('bilan terminé conservé sans ajouter la période hors application', () => {
  const d = { ...sample(), phase: 'done', remainingMs: null };
  const clock = helpers.resumeSessionClock(d, 1000000);
  assert.equal(clock.finishedAt - clock.startedAt, d.elapsedMs);
  assert.equal(clock.pausedLeft, null);
});

test('brouillons corrompus, versions inconnues et étapes invalides rejetés', () => {
  for (const raw of [null, '{', 'null', JSON.stringify({ ...sample(), version: 2 }),
    JSON.stringify({ ...sample(), index: 2 }), JSON.stringify({ ...sample(), steps: [null] }),
    JSON.stringify({ ...sample(), results: { 99: { reps: 2 } } }),
    JSON.stringify({ ...sample(), remainingMs: -1 })]) assert.equal(helpers.parseSessionDraft(raw), null);
});

test('écritures ordonnées, comptes isolés et suppression après une sauvegarde en attente', async () => {
  const data = new Map();
  const storage = {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => { await new Promise((resolve) => setTimeout(resolve, 3)); data.set(key, value); },
    removeItem: async (key) => { data.delete(key); },
  };
  const drafts = loadModule('sessionDraftStorage', {
    '@react-native-async-storage/async-storage': { __esModule: true, default: storage }, './sessionDraft': helpers,
  });
  await Promise.all([drafts.writeSessionDraft('alice', sample()), drafts.writeSessionDraft('bob', sample()),
    drafts.writeSessionDraft('alice', null)]);
  assert.equal(await drafts.readSessionDraft('alice'), null);
  assert.equal((await drafts.readSessionDraft('bob')).results[0].reps, 11);
});

test('un échec de stockage ne bloque pas les tentatives suivantes', async () => {
  let fail = true;
  let value = null;
  const drafts = loadModule('sessionDraftStorage', {
    '@react-native-async-storage/async-storage': { __esModule: true, default: {
      getItem: async () => value, removeItem: async () => { value = null; },
      setItem: async (_, next) => { if (fail) throw new Error('disque indisponible'); value = next; },
    } }, './sessionDraft': helpers,
  });
  await assert.rejects(drafts.writeSessionDraft('alice', sample()));
  fail = false;
  await drafts.writeSessionDraft('alice', sample());
  assert.equal((await drafts.readSessionDraft('alice')).note, 'À conserver');
});

