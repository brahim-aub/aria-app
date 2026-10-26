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
const { createLocalSaver } = load('lib/localSave.ts');

test('un échec devient visible et un nouvel échec ne masque pas l’alerte', async () => {
  const statuses = [];
  const save = createLocalSaver(async () => { throw new Error('stockage plein'); }, (failed) => statuses.push(failed));
  await save('premier état');
  await save('nouvel état');
  assert.deepEqual(statuses, [true, true]);
});

test('la reprise enregistre le dernier contenu et retire l’alerte après succès', async () => {
  let failed = true;
  let stored;
  const statuses = [];
  const save = createLocalSaver(async (value) => {
    if (failed) throw new Error('stockage indisponible');
    stored = value;
  }, (value) => statuses.push(value));
  await save('ancien état');
  assert.deepEqual(statuses, [true]);
  failed = false;
  const retry = save('état le plus récent');
  assert.deepEqual(statuses, [true]);
  await retry;
  assert.equal(stored, 'état le plus récent');
  assert.deepEqual(statuses, [true, false]);
});

test('une ancienne sauvegarde réussie ne masque pas l’échec de la dernière', async () => {
  const statuses = [];
  const writes = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const save = createLocalSaver(async (value) => {
    writes.push(value);
    if (value === 'ancien') await gate;
    else throw new Error('échec récent');
  }, (failed) => statuses.push(failed));
  const first = save('ancien');
  const second = save('récent');
  await Promise.resolve();
  assert.deepEqual(writes, ['ancien']);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(writes, ['ancien', 'récent']);
  assert.deepEqual(statuses, [true]);
});

const tag = (name) => function Stub({ children }) { return React.createElement(name, null, children); };
const { LocalSaveNotice } = load('components/LocalSaveNotice.tsx', {
  'react-native': { View: tag('div'), Text: tag('p') },
  'react-native-safe-area-context': { SafeAreaView: tag('section') },
  './kit': { Notice: ({ title, children }) => React.createElement('aside', null, title, children) },
  './ui': { Button: ({ title, disabled, onPress }) => React.createElement('button', { disabled, onClick: onPress }, title) },
  '@/theme': { colors: {}, font: {}, layout: { maxWidth: 640 }, spacing: { sm: 8 } },
});

test('le bandeau reste absent quand la sauvegarde fonctionne', () => {
  assert.equal(renderToStaticMarkup(React.createElement(LocalSaveNotice, {
    visible: false, retrying: false, onRetry() {},
  })), '');
});

test('le bandeau explique l’échec et propose une nouvelle tentative', () => {
  const markup = renderToStaticMarkup(React.createElement(LocalSaveNotice, {
    visible: true, retrying: false, onRetry() {},
  }));
  assert.match(markup, /Sauvegarde sur cet appareil impossible/);
  assert.match(markup, /Garde l’application ouverte/);
  assert.match(markup, /Réessayer/);
  const busy = renderToStaticMarkup(React.createElement(LocalSaveNotice, {
    visible: true, retrying: true, onRetry() {},
  }));
  assert.match(busy, /disabled/);
  assert.match(busy, /Enregistrement/);
});

