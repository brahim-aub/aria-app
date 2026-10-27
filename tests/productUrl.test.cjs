const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/', file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext('(function(require,module,exports){' + code + '\n})', { URL })(
    (id) => { if (!(id in imports)) throw Error('Unexpected import: ' + id); return imports[id]; }, module, module.exports);
  return module.exports;
}
const { productPageUrl } = load('productUrl.ts');
test('le faux domaine Carrefour signalé est refusé sans fabriquer de lien corrigé', () => {
  assert.equal(productPageUrl('https://www.carrefour.frij/p/fromage-r-p-parmigiano-reggiano-aop-carrefour-extra-3560070157198'), undefined);
  for (const host of ['carrefour.fr.evil.com', 'carrefour-fr.com', 'carrefour.frij', 'www.carrefour.fr.example.org']) {
    assert.equal(productPageUrl('https://' + host + '/p/produit'), undefined);
  }
});
test('le domaine officiel et le chemin exact sont conservés', () => {
  const url = 'https://www.carrefour.fr/p/fromage-3560070157198?store=12#details';
  assert.equal(productPageUrl(url), url);
  assert.equal(productPageUrl('https://drive.carrefour.fr/p/123'), 'https://drive.carrefour.fr/p/123');
  assert.equal(productPageUrl('https://www.auchan.fr/produit/p-123'), 'https://www.auchan.fr/produit/p-123');
});
test('adresses ambiguës, identifiants et protocoles non web refusés', () => {
  for (const url of [null, '', 'javascript:alert(1)', 'file:///tmp/produit', 'https://carrefour.fr@evil.com/p/123', 'https://www.carrefour.fr:8443/p/123', 'https://www.carrefour.fr/p/ mauvais']) {
    assert.equal(productPageUrl(url), undefined);
  }
});
test('un ancien faux lien en cache est ignoré et recherché à nouveau', async () => {
  let calls = 0;
  const old = { product: 'Riz', packSize: '1 kg', packGrams: 1000, packPrice: 2, pricePerKg: 2, url: 'https://www.carrefour.frij/p/riz' };
  const writes = [];
  const prices = load('prices.ts', {
    './productUrl': { productPageUrl },
    './gemini': { generateJSONWithSearch: async () => { calls++; return { data: { items: [{ ...old, id: 'i1', url: 'https://www.carrefour.fr/p/riz' }] }, queries: [], sources: [] }; } },
    './priceCache': { readPriceCache: async () => new Map([['riz', old]]), writePriceCache: async (_store, entries) => writes.push(...entries) },
  });
  const result = await prices.searchPrices({ createdAt: '2026-10-27', days: [{ meals: [{ items: [{ food: 'Riz', qty: '100 g', kcal: 100 }] }] }] }, ['Carrefour'], {});
  assert.equal(calls, 1);
  assert.equal(result.stores[0].items[0].url, 'https://www.carrefour.fr/p/riz');
  assert.equal(writes[0].item.url, 'https://www.carrefour.fr/p/riz');
});
test('un faux lien provenant du modèle ne devient pas un prix enregistré', async () => {
  const prices = load('prices.ts', {
    './productUrl': { productPageUrl },
    './gemini': { generateJSONWithSearch: async () => ({ data: { items: [{ id: 'i1', packGrams: 1000, packPrice: 2, url: 'https://www.carrefour.frij/p/riz' }] }, queries: ['riz'], sources: [] }) },
    './priceCache': { readPriceCache: async () => new Map(), writePriceCache: async () => {} },
  });
  const result = await prices.searchPrices({ createdAt: '2026-10-27', days: [{ meals: [{ items: [{ food: 'Riz', qty: '100 g', kcal: 100 }] }] }] }, ['Carrefour'], {});
  assert.equal(result.stores[0].items.length, 0);
});


test('une modification de menu réutilise les prix récents et recherche seulement le nouvel ingrédient', async () => {
  let calls = 0;
  const price = { id: 'old-id', product: 'Riz', packSize: '1 kg', packGrams: 1000, packPrice: 2, pricePerKg: 2, url: 'https://www.carrefour.fr/p/riz', foundAt: new Date().toISOString() };
  const prices = load('prices.ts', {
    './productUrl': { productPageUrl },
    './gemini': { generateJSONWithSearch: async (opts) => { calls++; assert.ok(!opts.contents[0].parts[0].text.includes(': Riz')); return { data: { items: [] }, queries: [], sources: [] }; } },
    './priceCache': { readPriceCache: async () => new Map(), writePriceCache: async () => {} },
  });
  const plan = { createdAt: 'new', days: [{ meals: [{ items: [{ food: 'Lait', qty: '250 ml', kcal: 100 }, { food: 'Riz', qty: '100 g', kcal: 100 }] }] }] };
  const old = { ingredients: [{ id: 'old-id', name: 'Riz', grams: 300 }], stores: [{ store: 'Carrefour', items: [price] }], searchedAt: new Date().toISOString() };
  const check = await prices.searchPrices(plan, ['Carrefour'], {}, undefined, old);
  assert.equal(calls, 1); assert.equal(check.stores[0].items[0].id, 'i2'); assert.equal(check.stores[0].items[0].product, 'Riz');
  old.stores[0].items[0].foundAt = '2020-01-01';
  // Un prix périmé doit être recherché : le modèle recevra aussi le riz.
  old.stores[0].items[0].url = 'https://www.carrefour.frij/p/riz';
  const noCache = load('prices.ts', {
    './productUrl': { productPageUrl },
    './gemini': { generateJSONWithSearch: async (opts) => { assert.ok(opts.contents[0].parts[0].text.includes(': Riz')); return { data: { items: [] }, queries: [], sources: [] }; } },
    './priceCache': { readPriceCache: async () => new Map(), writePriceCache: async () => {} },
  });
  assert.equal((await noCache.searchPrices(plan, ['Carrefour'], {}, undefined, old)).stores[0].items.length, 0);
});
