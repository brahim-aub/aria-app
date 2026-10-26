const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Charger les calculs réels sans démarrer les services réseau de l'application.
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/prices.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const loaded = { exports: {} };
vm.runInNewContext('(function(require,module,exports){' + code + '\n})')(
  (id) => { if (id !== './gemini' && id !== './priceCache') throw new Error('Unexpected import: ' + id); return {}; },
  loaded, loaded.exports);
const { itemGrams, ingredientsOf, storeTotals } = loaded.exports;
const item = (qty, extra = {}) => ({ food: 'Riz', qty, kcal: 0, ...extra });

test('quantités décimales avec virgule, point et unité accolée', () => {
  for (const [qty, expected] of [
    ['0,5 kg', 500], ['0.5 kg', 500], ['0,5kg', 500],
    ['1.5 L', 1500], ['1,5l', 1500], ['12,5 cl', 125],
    ['0,25 g', 0.25], ['2,5 ml', 2.5], ['500g', 500], ['250ml', 250],
  ]) assert.equal(itemGrams(item(qty)), expected, qty);
});

test('quantités entières, cuillères et grammes fournis restent compatibles', () => {
  for (const [qty, expected] of [
    ['500 g', 500], ['20 cl', 200], ['1 litre', 1000],
    ['1 c.à.s.', 12], ['1,5 c.à.s.', 18], ['2 cuillère à café', 10],
  ]) assert.equal(itemGrams(item(qty)), expected, qty);
  assert.equal(itemGrams(item('0,5 kg', { grams: 420 })), 420);
  assert.equal(itemGrams(item('au goût')), undefined);
  assert.equal(itemGrams(item('2 pièces')), undefined);
});

test('la quantité décimale se répercute dans le panier et le coût consommé', () => {
  const ingredients = ingredientsOf({ days: [
    { meals: [{ items: [item('0,5 kg'), item('250 g')] }] },
  ] });
  assert.equal(ingredients.length, 1);
  assert.equal(ingredients[0].grams, 750);
  const totals = storeTotals({ ingredients, stores: [{
    store: 'Test', items: [{ id: ingredients[0].id, packGrams: 500, packPrice: 2, pricePerKg: 4 }],
  }] });
  assert.equal(totals[0].basket, 4);
  assert.equal(totals[0].portions, 3);
  assert.equal(totals[0].found, 1);
});

