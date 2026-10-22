/**
 * Cache de prix partagé entre utilisateurs (table price_cache).
 * - Un prix trouvé en ligne pour un produit dans un magasin sert à tout le monde pendant 7 jours.
 * - Un produit cherché mais introuvable dans ce magasin n'est pas recherché à nouveau pendant 3 jours.
 * Chaque entrée évite une recherche Google payante. Sans compte connecté, le cache est ignoré.
 */
import type { StoreItemPrice } from '@/store/types';

import { supabase } from './supabase';

type CachedItem = Omit<StoreItemPrice, 'id'>;
/** Produit cherché sans succès dans ce magasin. */
export type CacheEntry = CachedItem | 'missing';

const DAY = 24 * 3600 * 1000;
export const PRICE_TTL_DAYS = 7;
export const MISSING_TTL_DAYS = 3;

async function signedIn() {
  return !!supabase && !!(await supabase.auth.getSession()).data.session;
}

/** Entrées récentes connues pour ces produits (clé normalisée → prix, ou « missing »). */
export async function readPriceCache(store: string, keys: string[]): Promise<Map<string, CacheEntry>> {
  const out = new Map<string, CacheEntry>();
  if (!keys.length || !(await signedIn())) return out;
  const weekAgo = new Date(Date.now() - PRICE_TTL_DAYS * DAY).toISOString();
  const missingSince = Date.now() - MISSING_TTL_DAYS * DAY;
  const { data, error } = await supabase!
    .from('price_cache')
    .select('product_key, item, found_at')
    .eq('store', store)
    .in('product_key', keys)
    .gte('found_at', weekAgo);
  if (error || !data) return out;
  for (const row of data) {
    const item = row.item as CachedItem | { missing: true };
    if ('missing' in item) {
      if (new Date(row.found_at as string).getTime() >= missingSince) out.set(row.product_key as string, 'missing');
    } else out.set(row.product_key as string, { ...item, foundAt: row.found_at as string });
  }
  return out;
}

/** Enregistre les prix trouvés (et les introuvables) ; une entrée récente d'un autre utilisateur n'est pas écrasée (règle RLS). */
export async function writePriceCache(store: string, entries: { key: string; item: CacheEntry }[]) {
  if (!entries.length || !(await signedIn())) return;
  const uid = (await supabase!.auth.getSession()).data.session!.user.id;
  const now = new Date().toISOString();
  await Promise.all(
    entries.map(({ key, item }) =>
      supabase!.from('price_cache').upsert({ store, product_key: key, item: item === 'missing' ? { missing: true } : item, found_at: now, found_by: uid }).then(
        () => undefined,
        () => undefined,
      ),
    ),
  );
}
