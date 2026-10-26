const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(relative, imports = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src', relative), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext('(function(require,module,exports){' + code + '\n})')(
    (id) => id in imports ? imports[id] : require(id), module, module.exports);
  return module.exports;
}
const { readLocalSnapshot, decodeLocalObject } = load('lib/localLoad.ts');

test('un échec de lecture laisse les sauvegardes désactivées', async () => {
  const raw = '{"profile":{"name":"À préserver"}}';
  let writes = 0;
  const result = await readLocalSnapshot(async () => { throw new Error('lecture refusée'); });
  if (result.ready) writes++;
  assert.equal(result.ready, false);
  assert.equal(writes, 0);
  assert.equal(raw, '{"profile":{"name":"À préserver"}}');
});

test('une sauvegarde JSON corrompue bloque le démarrage sans être remplacée', async () => {
  const corrupted = '{"profile":';
  const result = await readLocalSnapshot(async () => decodeLocalObject(corrupted));
  assert.equal(result.ready, false);
  for (const raw of ['null', '[]', 'false', '42', '""', '']) {
    assert.equal((await readLocalSnapshot(async () => decodeLocalObject(raw))).ready, false, raw);
  }
});

test('une nouvelle installation vide peut démarrer normalement', async () => {
  const result = await readLocalSnapshot(async () => null);
  assert.equal(result.ready, true);
  assert.equal(result.data, null);
});

test('une seconde tentative récupère les données existantes au lieu d’un profil vide', async () => {
  let fails = true;
  const stored = '{"profile":{"name":"Profil existant"},"logs":[{"id":"séance conservée"}]}';
  const read = async () => {
    if (fails) throw new Error('stockage temporairement indisponible');
    return decodeLocalObject(stored);
  };
  assert.equal((await readLocalSnapshot(read)).ready, false);
  fails = false;
  const result = await readLocalSnapshot(read);
  assert.equal(result.ready, true);
  assert.equal(result.data.profile.name, 'Profil existant');
  assert.equal(result.data.logs[0].id, 'séance conservée');
});

test('une erreur de migration laisse également le démarrage bloqué', async () => {
  const result = await readLocalSnapshot(async () => { decodeLocalObject('{"name":"Ancien profil"}'); throw new Error('migration interrompue'); });
  assert.equal(result.ready, false);
});

const tag = (name) => ({ children }) => React.createElement(name, null, children);
const { LocalLoadError } = load('components/LocalLoadError.tsx', {
  'react-native': { View: tag('div'), Text: tag('span') },
  'react-native-safe-area-context': { SafeAreaView: tag('section') },
  './ui': { Button: ({ title, disabled }) => React.createElement('button', { disabled }, title) },
  '@/theme': { colors: {}, font: {}, spacing: {} },
});
test('l’écran de protection explique le blocage et propose uniquement une nouvelle lecture', () => {
  const html = renderToStaticMarkup(React.createElement(LocalLoadError, { retrying: false, onRetry() {} }));
  assert.match(html, /Données locales indisponibles/);
  assert.match(html, /protéger ta sauvegarde/);
  assert.match(html, /Réessayer/);
  assert.doesNotMatch(html, /disabled/);
  const retry = renderToStaticMarkup(React.createElement(LocalLoadError, { retrying: true, onRetry() {} }));
  assert.match(retry, /Lecture en cours/);
  assert.match(retry, /disabled/);
});

