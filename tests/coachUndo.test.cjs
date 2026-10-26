const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/coachUndo.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const loaded = { exports: {} };
vm.runInNewContext('(function(module,exports){' + code + '\n})')(loaded, loaded.exports);
const { getCoachUndoPatch } = loaded.exports;
const clone = (v) => JSON.parse(JSON.stringify(v));
const state = () => ({
  profile: { name: 'Test', weightKg: 75, sessionsPerWeek: 3 },
  plan: { startDate: '2026-10-26', templates: [] },
  overrides: {}, limitations: [], customSessions: [],
  nutrition: { prefsSet: true, prefs: { diet: 'omnivore', likes: 'riz' } },
  logs: [], weights: [], counters: {}, chat: [],
});
const message = (before, after) => ({ undo: clone(before), undoAfter: clone(after) });
const adapted = (before) => ({
  ...clone(before), overrides: { '2026-10-26': { kind: 'skip', reason: 'Report demandé' } },
});
const plain = (value) => JSON.parse(JSON.stringify(value));

test('annuler restaure uniquement les données modifiées par cette action', () => {
  const before = state();
  const after = adapted(before);
  const patch = getCoachUndoPatch(after, message(before, after));
  assert.deepEqual(Object.keys(patch), ['overrides']);
  assert.deepEqual(plain({ ...after, ...patch }), before);
});

test('une modification manuelle du même planning bloque toute annulation', () => {
  const before = state();
  const after = adapted(before);
  const current = { ...after, overrides: { '2026-10-27': { kind: 'skip' } } };
  const initial = JSON.stringify(current);
  assert.equal(getCoachUndoPatch(current, message(before, after)), null);
  assert.equal(JSON.stringify(current), initial);
});

test('les préférences, pesées et notes ajoutées ensuite restent intactes', () => {
  const before = state();
  const after = adapted(before);
  const current = {
    ...after, profile: { ...after.profile, weightKg: 76 },
    nutrition: { ...after.nutrition, prefs: { ...after.nutrition.prefs, likes: 'pâtes' } },
    logs: [{ note: 'Note manuelle' }], weights: [{ kg: 76 }],
  };
  const result = { ...current, ...getCoachUndoPatch(current, message(before, after)) };
  assert.equal(result.profile.weightKg, 76);
  assert.equal(result.nutrition.prefs.likes, 'pâtes');
  assert.equal(result.logs[0].note, 'Note manuelle');
  assert.equal(result.weights[0].kg, 76);
});

test('si une seule partie d’une action multiple a changé, rien n’est annulé', () => {
  const before = state();
  const after = { ...adapted(before), profile: { ...before.profile, sessionsPerWeek: 4 } };
  const current = { ...after, profile: { ...after.profile, sessionsPerWeek: 5 } };
  assert.equal(getCoachUndoPatch(current, message(before, after)), null);
});

test('les menus et prix générés ensuite ne bloquent pas l’annulation des goûts et sont conservés', () => {
  const before = state();
  const after = { ...before, nutrition: { ...before.nutrition, prefs: { ...before.nutrition.prefs, likes: 'pâtes' } } };
  const current = { ...after, nutrition: { ...after.nutrition,
    plan: { createdAt: 'nouveau menu' }, priceCheck: { searchedAt: 'nouveaux prix' } } };
  const patch = getCoachUndoPatch(current, message(before, after));
  assert.equal(patch.nutrition.prefs.likes, 'riz');
  assert.equal(patch.nutrition.plan, current.nutrition.plan);
  assert.equal(patch.nutrition.priceCheck, current.nutrition.priceCheck);
});

test('les goûts modifiés manuellement après le coach bloquent leur annulation', () => {
  const before = state();
  const after = { ...before, nutrition: { ...before.nutrition, prefsSet: false } };
  const current = { ...after, nutrition: { ...after.nutrition, prefs: { likes: 'autre' } } };
  assert.equal(getCoachUndoPatch(current, message(before, after)), null);
});

test('un rechargement JSON avec des clés réordonnées garde une annulation valide', () => {
  const before = state();
  const after = adapted(before);
  const current = { ...clone(after), overrides: { '2026-10-26': { reason: 'Report demandé', kind: 'skip', unused: undefined } } };
  assert.notEqual(getCoachUndoPatch(current, message(before, after)), null);
});

test('les messages anciens et actions sans changement ne sont pas annulables', () => {
  const current = state();
  assert.equal(getCoachUndoPatch(current, { undo: current }), null);
  assert.equal(getCoachUndoPatch(current, message(current, current)), null);
});


test('le bouton est désactivé et son explication est visible en cas de conflit', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const native = {
    View: ({ children }) => React.createElement('div', null, children),
    Text: ({ children }) => React.createElement('span', null, children),
    Pressable: ({ children, disabled }) => React.createElement('button', { disabled }, children),
    StyleSheet: { create: (value) => value },
  };
  const source = fs.readFileSync(path.join(__dirname, '../src/app/(tabs)/coach.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const theme = { colors: {}, font: {}, radius: {}, spacing: {} };
  const module = { exports: {} };
  vm.runInNewContext('(function(require,module,exports){' + compiled + '\nexports.TestBubble = Bubble;\n})')(
    (id) => {
      if (id === 'react' || id === 'react/jsx-runtime') return require(id);
      if (id === 'react-native') return native;
      if (id === '@expo/vector-icons/Ionicons') return { __esModule: true, default: () => null };
      if (id === '@/theme') return theme;
      return {};
    }, module, module.exports);
  const msg = { id: 'test', role: 'model', text: 'Séance adaptée.', changes: ['Séance déplacée'], undo: {} };
  const reason = 'Annulation indisponible : les données concernées ont changé depuis cette action.';
  const blocked = renderToStaticMarkup(React.createElement(module.exports.TestBubble, {
    msg, onUndo() {}, undoDisabledReason: reason,
  }));
  assert.match(blocked, /disabled/);
  assert.ok(blocked.includes(reason));
  const available = renderToStaticMarkup(React.createElement(module.exports.TestBubble, { msg, onUndo() {} }));
  assert.doesNotMatch(available, /disabled/);
  assert.ok(!available.includes(reason));
});

