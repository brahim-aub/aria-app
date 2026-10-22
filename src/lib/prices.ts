/**
 * Prix réels des courses dans les magasins choisis, trouvés par Gemini via une recherche Google.
 * Aucun prix estimé : chaque prix doit venir d'une page web (url), sinon l'aliment reste « non trouvé ».
 */
import type { MealItem, MealPlan, PriceCheck, StoreItemPrice, StorePrices } from '@/store/types';

import { AiAuth, generateJSONWithSearch } from './gemini';
import { readPriceCache, writePriceCache } from './priceCache';

export const STORES = [
  'E.Leclerc',
  'Carrefour',
  'Auchan',
  'Intermarché',
  'Lidl',
  'Aldi',
  'Super U',
  'Monoprix',
  'Casino',
  'Netto',
  'Franprix',
  'Grand Frais',
  'Biocoop',
];

/** Au-delà, la recherche devient trop longue et moins fiable. */
export const MAX_STORES = 3;

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim();

/** Mots qui ne changent pas le produit acheté en rayon. */
const NOISE = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'un', 'une', 'en', 'a', 'au', 'aux', 'et', 'cuit', 'cuite', 'cuits', 'cuites', 'cru', 'crue', 'crus', 'crues', 'sec', 'seche', 'secs', 'seches', 'nature', 'frais', 'fraiche', 'paquet', 'boite', 'sachet']);

/**
 * Clé d'un produit pour le cache partagé : « Riz basmati cru (1 kg) », « riz basmati » et « Basmati, riz »
 * donnent la même clé, donc un seul achat de recherche Google pour tout le monde.
 */
export function productKey(name: string) {
  const words = norm(name)
    // Les pourcentages comptent (fromage blanc 0 % ≠ 20 %) ; les quantités (500 g, 1 L, x6) non.
    .replace(/(\d+(?: \d+)?)\s*%/g, (_m, n: string) => ` ${n.replace(' ', '_')}pct `)
    .replace(/\b\d+(\s\d+)?\s*(kg|g|gr|mg|l|cl|ml|x)?\b|\bx\s?\d+\b/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !NOISE.has(w))
    // Pluriel simple : « pommes » = « pomme », « noix » reste « noix ».
    .map((w) => (w.length > 3 && /[^s]s$/.test(w) && !w.endsWith('ss') ? w.slice(0, -1) : w));
  return [...new Set(words)].sort().join(' ');
}

/** Enseignes reconnues même écrites autrement (« Leclerc », « e.leclerc drive », « Hyper U »…). */
const STORE_ALIASES: [RegExp, string][] = [
  [/leclerc/, 'E.Leclerc'],
  [/carrefour/, 'Carrefour'],
  [/auchan/, 'Auchan'],
  [/intermarche|intermarch/, 'Intermarché'],
  [/\blidl\b/, 'Lidl'],
  [/\baldi\b/, 'Aldi'],
  [/\b(super|hyper|marche) u\b|\bu express\b|coursesu/, 'Super U'],
  [/monoprix/, 'Monoprix'],
  [/casino/, 'Casino'],
  [/\bnetto\b/, 'Netto'],
  [/franprix/, 'Franprix'],
  [/grand frais/, 'Grand Frais'],
  [/biocoop/, 'Biocoop'],
];

/** Nom d'enseigne commun à tous les utilisateurs (clé du cache). */
export function storeKey(store: string) {
  const n = norm(store);
  return STORE_ALIASES.find(([re]) => re.test(n))?.[1] ?? store.trim();
}

/** Nom recherché : le nom précis donné par l'IA, sinon le libellé du repas. */
export const itemName = (item: Pick<MealItem, 'food' | 'search'>) => (item.search || item.food).replace(/\(.*?\)/g, '').trim();
export const itemKey = (item: Pick<MealItem, 'food' | 'search'>) => productKey(itemName(item));

/** Poids consommé en grammes : fourni par l'IA, sinon déduit du texte (« 60 g », « 20 cl », « 1 c.à.s. »…). */
export function itemGrams(item: MealItem): number | undefined {
  if (item.grams && item.grams > 0) return item.grams;
  const q = norm(item.qty).replace(',', '.');
  const num = parseFloat(q.match(/[\d.]+/)?.[0] ?? '');
  if (!Number.isFinite(num)) return undefined;
  if (/\bkg\b/.test(q)) return num * 1000;
  if (/\bg\b|gramme/.test(q)) return num;
  if (/\bml\b/.test(q)) return num;
  if (/\bcl\b/.test(q)) return num * 10;
  if (/\bl\b|litre/.test(q)) return num * 1000;
  if (/c a s|cuillere a soupe/.test(q)) return num * 12;
  if (/c a c|cuillere a cafe/.test(q)) return num * 5;
  return undefined;
}

/** Ingrédients de la semaine, regroupés, avec la quantité totale à acheter. */
export function ingredientsOf(plan: MealPlan) {
  const map = new Map<string, { id: string; name: string; grams: number }>();
  for (const d of plan.days)
    for (const m of d.meals)
      for (const it of m.items) {
        const k = itemKey(it);
        const cur = map.get(k) ?? { id: `i${map.size + 1}`, name: itemName(it), grams: 0 };
        cur.grams += itemGrams(it) ?? 0;
        map.set(k, cur);
      }
  return [...map.values()];
}

// ───────── Recherche ─────────

const SCHEMA = {
  type: 'object',
  properties: {
    note: { type: 'string', description: 'Remarque courte (ex. site consulté, produits introuvables)' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: "Identifiant de l'ingrédient (i1, i2…)" },
          product: { type: 'string', description: 'Nom exact du produit trouvé, avec la marque' },
          packSize: { type: 'string', description: 'Contenance affichée, ex. 500 g, 1 L, x6' },
          packGrams: { type: 'number', description: 'Contenance en grammes (ou ml)' },
          packPrice: { type: 'number', description: 'Prix du produit en euros' },
          pricePerKg: { type: 'number', description: 'Prix au kilo (ou au litre) en euros' },
          url: { type: 'string', description: 'Adresse exacte de la page où ce prix est affiché' },
          minPerKg: { type: 'number', description: 'Prix au kilo le plus bas parmi les variantes vues chez ce magasin' },
          maxPerKg: { type: 'number', description: 'Prix au kilo le plus haut parmi les variantes vues chez ce magasin' },
        },
        required: ['id', 'product', 'packSize', 'packGrams', 'packPrice', 'pricePerKg', 'url'],
      },
    },
  },
  required: ['items'],
};

function clean(raw: Partial<StoreItemPrice>, ids: Set<string>): StoreItemPrice | undefined {
  const id = String(raw.id ?? '').trim();
  const url = String(raw.url ?? '').trim();
  const packPrice = Number(raw.packPrice);
  const packGrams = Number(raw.packGrams);
  if (!ids.has(id) || !/^https?:\/\/\S+\.\S+/.test(url) || !(packPrice > 0) || !(packGrams > 0)) return undefined;
  const pricePerKg = Number(raw.pricePerKg) > 0 ? Number(raw.pricePerKg) : packPrice / (packGrams / 1000);
  // Fourchette des variantes (ex. riz basmati de 2,58 à 3,65 €/kg) : gardée seulement si elle encadre le prix retenu.
  const min = Number(raw.minPerKg);
  const max = Number(raw.maxPerKg);
  const range = min > 0 && max > min && min <= pricePerKg * 1.01 && max >= pricePerKg * 0.99 ? { minPerKg: min, maxPerKg: max } : {};
  return { id, url, packPrice, packGrams, pricePerKg, ...range, product: String(raw.product ?? '').slice(0, 120), packSize: String(raw.packSize ?? '').slice(0, 40) };
}

async function searchStore(store: string, all: { id: string; name: string; grams: number }[], ai: AiAuth) {
  // 1. Prix déjà relevés cette semaine (par n'importe quel utilisateur) : pas de nouvelle recherche.
  // Prix trouvés il y a moins de 7 jours, ou produit introuvable chez ce magasin il y a moins de 3 jours.
  const shop = storeKey(store);
  const cache = await readPriceCache(shop, [...new Set(all.map((i) => productKey(i.name)))]);
  const cached: StoreItemPrice[] = [];
  const ingredients = all.filter((i) => {
    const hit = cache.get(productKey(i.name));
    if (hit && hit !== 'missing') cached.push({ ...hit, id: i.id });
    return !hit;
  });
  if (!ingredients.length) return { store: { store, items: cached, note: 'Prix déjà connus cette semaine : aucune nouvelle recherche n’a été nécessaire.' } as StorePrices, sources: [] };

  // 2. Recherche en ligne des produits restants, par petits lots : une seule requête pour toute la semaine
  // (40 ingrédients et plus) dépasse le délai du relais. Chaque lot est mis en cache dès qu'il arrive.
  const batches: (typeof ingredients)[] = [];
  for (let i = 0; i < ingredients.length; i += BATCH_SIZE) batches.push(ingredients.slice(i, i + BATCH_SIZE));
  const results: Awaited<ReturnType<typeof searchBatch>>[] = [];
  let firstError: unknown;
  for (let i = 0; i < batches.length; i += PARALLEL_BATCHES) {
    const round = await Promise.allSettled(batches.slice(i, i + PARALLEL_BATCHES).map((b) => searchBatch(store, shop, b, ai)));
    for (const r of round) {
      if (r.status === 'fulfilled') results.push(r.value);
      else firstError ??= r.reason;
    }
  }
  if (!results.length && firstError) throw firstError;
  const sources = results.flatMap((r) => r.sources);
  const note = results.length < batches.length ? `Recherche incomplète : ${batches.length - results.length} lot(s) sur ${batches.length} n'ont pas abouti. Relance la recherche pour compléter (les prix déjà trouvés ne seront pas recherchés à nouveau).` : undefined;
  return { store: { store, items: [...cached, ...results.flatMap((r) => r.items)], note } as StorePrices, sources };
}

/** Ingrédients par appel : de petites questions, comme dans l'app Gemini, donnent une réponse en quelques secondes. */
const BATCH_SIZE = 4;
/** Lots lancés en même temps pour un magasin. */
const PARALLEL_BATCHES = 6;

async function searchBatch(store: string, shop: string, ingredients: { id: string; name: string; grams: number }[], ai: AiAuth) {
  const list = ingredients.map((i) => `${i.id} : ${i.name}`).join('\n');
  const res = await generateJSONWithSearch<{ note?: string; items: Partial<StoreItemPrice>[] }>({
    ...ai,
    kind: 'prices',
    // Flash-Lite (choix du 22/10/2026) : rapide (quelques secondes) et peu cher, mais il cherche rarement
    // sur Google. Ses prix sont donc affichés comme indicatifs quand aucune recherche n'a eu lieu.
    tier: 'eco',
    temperature: 0.2,
    timeoutMs: 45000,
    requireSearch: false,
    system: `Tu es un assistant de courses. Tu donnes les prix actuels de l'enseigne « ${store} » en France, en cherchant sur internet (Google) si possible : site drive ou site officiel de l'enseigne, ou comparateur de prix fiable qui cite ce magasin.
Règles strictes :
- Donne le prix habituel d'un produit réellement vendu chez ${store}, jamais un prix au hasard. Indique dans "url" la page du produit (ou à défaut la page du rayon) chez ${store}.
- Si tu ne connais pas de prix fiable pour un ingrédient chez ${store}, ne l'inclus pas.
- Pour chaque ingrédient, choisis le produit le plus proche de la demande au meilleur prix (la marque distributeur est acceptée).
- S'il existe plusieurs variantes (ex. riz basmati premier prix ou supérieur), donne aussi la fourchette de prix au kilo des variantes vues (minPerKg, maxPerKg).
- Va vite : une recherche par ingrédient suffit.
- packGrams = contenance en grammes (ou ml) ; pricePerKg = prix au kilo (ou au litre).`,
    contents: [{ role: 'user', parts: [{ text: `Trouve chez ${store} le prix de ces ingrédients :\n${list}` }] }],
    schema: SCHEMA,
  });
  const ids = new Set(ingredients.map((i) => i.id));
  const seen = new Set<string>();
  const foundAt = new Date().toISOString();
  // Vérifié = Gemini a réellement fait une recherche Google pour ce lot ; sinon prix indicatif.
  const verified = res.queries.length > 0 || res.sources.length > 0;
  const items = (res.data.items ?? [])
    .map((r) => clean(r, ids))
    .filter((x): x is StoreItemPrice => !!x && !seen.has(x.id) && !!seen.add(x.id))
    .map((x) => ({ ...x, foundAt, verified }));
  const nameOf = new Map(ingredients.map((i) => [i.id, i.name]));
  const foundIds = new Set(items.map((x) => x.id));
  await writePriceCache(shop, [
    ...items.map(({ id, ...item }) => ({ key: productKey(nameOf.get(id) ?? ''), item })),
    // Cherchés mais introuvables : mémorisés aussi, pour ne pas repayer la même recherche vaine.
    ...ingredients.filter((i) => !foundIds.has(i.id)).map((i) => ({ key: productKey(i.name), item: 'missing' as const })),
  ]);
  return { items, note: res.data.note, sources: res.sources };
}

/** Cherche les prix réels du plan dans chaque magasin choisi (une recherche par magasin, en parallèle). */
export async function searchPrices(plan: MealPlan, stores: string[], ai: AiAuth, onStoreDone?: (store: string) => void): Promise<PriceCheck> {
  const ingredients = ingredientsOf(plan);
  const results = await Promise.allSettled(
    stores.slice(0, MAX_STORES).map(async (s) => {
      const r = await searchStore(s, ingredients, ai);
      onStoreDone?.(s);
      return r;
    }),
  );
  const ok = results.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof searchStore>>> => r.status === 'fulfilled').map((r) => r.value);
  if (!ok.length) {
    const first = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    throw first?.reason ?? new Error('Aucun prix trouvé.');
  }
  const sources = new Map<string, { title: string; url: string }>();
  ok.forEach((r) => r.sources.forEach((s) => sources.set(s.url, s)));
  return {
    planCreatedAt: plan.createdAt,
    searchedAt: new Date().toISOString(),
    sources: [...sources.values()].slice(0, 30),
    ingredients,
    stores: ok.map((r) => r.store),
  };
}

// ───────── Calculs ─────────

export type StoreTotal = {
  store: string;
  /** Ticket de caisse : paquets entiers à acheter pour la semaine. */
  basket: number;
  /** Coût des quantités réellement mangées. */
  portions: number;
  found: number;
  total: number;
};

export function storeTotals(check: PriceCheck): StoreTotal[] {
  return check.stores
    .map((s) => {
      let basket = 0;
      let portions = 0;
      let found = 0;
      for (const ing of check.ingredients) {
        const p = s.items.find((i) => i.id === ing.id);
        if (!p || !ing.grams) continue;
        found++;
        basket += Math.max(1, Math.ceil(ing.grams / p.packGrams)) * p.packPrice;
        portions += (ing.grams / 1000) * p.pricePerKg;
      }
      return { store: s.store, basket, portions, found, total: check.ingredients.length };
    })
    .sort((a, b) => b.found - a.found || a.basket - b.basket);
}

/** Prix d'un ingrédient du repas dans un magasin donné. */
export function itemPrice(item: MealItem, check: PriceCheck | undefined, store: string | undefined) {
  if (!check || !store) return undefined;
  const ing = check.ingredients.find((i) => productKey(i.name) === itemKey(item));
  const s = check.stores.find((x) => x.store === store);
  const p = ing && s?.items.find((i) => i.id === ing.id);
  if (!p) return undefined;
  const grams = itemGrams(item);
  return { price: p, cost: grams != null ? (grams / 1000) * p.pricePerKg : undefined };
}

export const euro = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export function gramsLabel(g: number) {
  return g >= 1000 ? `${(g / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kg` : `${Math.round(g)} g`;
}
