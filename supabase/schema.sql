-- Aria Sport : données des comptes utilisateurs.
-- À coller dans Supabase > SQL Editor > New query, puis « Run ».

-- Une ligne par utilisateur : tout l'état de l'app (profil, programme, séances, nutrition…).
create table if not exists public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Accès via l'API (le projet n'expose pas les nouvelles tables automatiquement).
-- Seuls les utilisateurs connectés y accèdent, jamais les visiteurs anonymes.
revoke all on public.user_data from anon;
grant select, insert, update, delete on public.user_data to authenticated;

-- Sécurité : chaque utilisateur ne voit et ne modifie que sa propre ligne.
alter table public.user_data enable row level security;

drop policy if exists "Lecture de ses données" on public.user_data;
create policy "Lecture de ses données" on public.user_data
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Création de ses données" on public.user_data;
create policy "Création de ses données" on public.user_data
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Mise à jour de ses données" on public.user_data;
create policy "Mise à jour de ses données" on public.user_data
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Suppression de ses données" on public.user_data;
create policy "Suppression de ses données" on public.user_data
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Suppression du compte par l'utilisateur lui-même (droit à l'effacement, RGPD).
-- Les données de user_data partent avec, grâce au « on delete cascade ».
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Non connecté';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
