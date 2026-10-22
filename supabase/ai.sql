-- Aria Sport : relais Gemini (Edge Function « gemini »), quotas, interrupteurs et cache de prix partagé.
-- À exécuter après schema.sql, dans Supabase > SQL Editor.

-- ───────── Consommation IA (une ligne par utilisateur, jour et fonction) ─────────
create table if not exists public.ai_usage (
  user_id    uuid not null references auth.users (id) on delete cascade,
  day        date not null default current_date,
  kind       text not null check (kind in ('chat', 'meal', 'prices', 'test')),
  calls      integer not null default 0,
  tokens_in  bigint not null default 0,
  tokens_out bigint not null default 0,
  searches   integer not null default 0,
  primary key (user_id, day, kind)
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;
grant select on public.ai_usage to authenticated;
drop policy if exists "Lecture de sa consommation" on public.ai_usage;
create policy "Lecture de sa consommation" on public.ai_usage
  for select to authenticated using ((select auth.uid()) = user_id);

-- ───────── Réglages modifiables à distance (sans republier l'app) ─────────
create table if not exists public.app_config (
  key   text primary key,
  value jsonb not null
);
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;
-- L'Edge Function (rôle service) lit les quotas et interrupteurs : sans ce droit, ils sont ignorés.
grant select on public.app_config to service_role;

insert into public.app_config (key, value) values
  ('ai', '{"enabled": true, "prices_enabled": true, "daily_limits": {"chat": 60, "meal": 4, "prices": 60, "test": 10}}')
on conflict (key) do nothing;

-- Prend une « place » dans le quota du jour ; false si la limite est atteinte (atomique).
create or replace function public.ai_take_quota(p_user uuid, p_kind text, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  insert into public.ai_usage (user_id, day, kind, calls)
  values (p_user, current_date, p_kind, 1)
  on conflict (user_id, day, kind) do update
    set calls = public.ai_usage.calls + 1
    where public.ai_usage.calls < p_limit
  returning calls into n;
  return n is not null;
end;
$$;

create or replace function public.ai_add_usage(p_user uuid, p_kind text, p_in bigint, p_out bigint, p_searches integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_usage
     set tokens_in = tokens_in + p_in, tokens_out = tokens_out + p_out, searches = searches + p_searches
   where user_id = p_user and day = current_date and kind = p_kind;
$$;

-- Rend une « place » prise pour un appel qui a échoué côté Google (il ne doit pas compter).
create or replace function public.ai_refund_quota(p_user uuid, p_kind text)
returns void
language sql
security definer
set search_path = ''
as $
  update public.ai_usage
     set calls = greatest(calls - 1, 0)
   where user_id = p_user and day = current_date and kind = p_kind;
$;

-- Réservées à l'Edge Function (clé secrète) : ni l'app ni les visiteurs ne peuvent les appeler.
revoke all on function public.ai_take_quota(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.ai_add_usage(uuid, text, bigint, bigint, integer) from public, anon, authenticated;
revoke all on function public.ai_refund_quota(uuid, text) from public, anon, authenticated;
grant execute on function public.ai_take_quota(uuid, text, integer) to service_role;
grant execute on function public.ai_add_usage(uuid, text, bigint, bigint, integer) to service_role;
grant execute on function public.ai_refund_quota(uuid, text) to service_role;

-- ───────── Cache de prix partagé entre utilisateurs (7 jours) ─────────
-- Un prix trouvé en ligne pour un produit dans un magasin sert à tout le monde pendant 7 jours :
-- une seule recherche Google (payante) au lieu d'une par utilisateur.
create table if not exists public.price_cache (
  store       text not null,
  product_key text not null,
  item        jsonb not null,
  found_at    timestamptz not null default now(),
  found_by    uuid references auth.users (id) on delete set null,
  primary key (store, product_key)
);
alter table public.price_cache enable row level security;
revoke all on public.price_cache from anon;
grant select, insert, update on public.price_cache to authenticated;

-- Lecture de tout le cache (l'app ne garde que les prix de moins de 7 jours) : un « upsert »
-- doit pouvoir lire la ligne existante pour remplacer un prix périmé.
drop policy if exists "Lecture des prix récents" on public.price_cache;
drop policy if exists "Lecture du cache de prix" on public.price_cache;
create policy "Lecture du cache de prix" on public.price_cache
  for select to authenticated using (true);

drop policy if exists "Ajout de prix" on public.price_cache;
create policy "Ajout de prix" on public.price_cache
  for insert to authenticated with check ((select auth.uid()) = found_by);

drop policy if exists "Remplacement des prix périmés" on public.price_cache;
create policy "Remplacement des prix périmés" on public.price_cache
  for update to authenticated
  using (found_at <= now() - interval '7 days' or found_by = (select auth.uid()))
  with check ((select auth.uid()) = found_by);
