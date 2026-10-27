-- Mova : appliquer avant de déployer la fonction gemini mise à jour.
-- Aucun changement des quotas existants.
create table if not exists public.ai_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  fingerprint text not null,
  owner uuid not null,
  expires_at timestamptz not null,
  response_text text,
  response_status integer,
  primary key (user_id, fingerprint)
);
alter table public.ai_requests enable row level security;
revoke all on public.ai_requests from public, anon, authenticated;
grant all on public.ai_requests to service_role;
create index if not exists ai_requests_expiry on public.ai_requests(expires_at);

create or replace function public.ai_claim_request(p_user uuid, p_hash text, p_owner uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare claimed uuid; result jsonb;
begin
  -- Purge bornée des réponses expirées, même si leur propriétaire ne revient pas.
  delete from public.ai_requests where ctid in (select ctid from public.ai_requests where expires_at < now() limit 100);
  insert into public.ai_requests(user_id,fingerprint,owner,expires_at)
  values(p_user,p_hash,p_owner,now()+interval '5 minutes')
  on conflict(user_id,fingerprint) do nothing returning owner into claimed;
  if claimed is not null then return jsonb_build_object('state','acquired'); end if;
  select jsonb_build_object('state',case when response_status is null then 'pending' else 'complete' end,
    'text',response_text,'status',response_status) into result
    from public.ai_requests where user_id=p_user and fingerprint=p_hash;
  return coalesce(result,jsonb_build_object('state','pending'));
end; $$;
create or replace function public.ai_finish_request(p_user uuid,p_hash text,p_owner uuid,p_status integer,p_text text)
returns void language sql security definer set search_path = '' as $$
  update public.ai_requests set response_status=p_status,response_text=p_text,expires_at=now()+interval '2 minutes'
  where user_id=p_user and fingerprint=p_hash and owner=p_owner;
$$;
revoke all on function public.ai_claim_request(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.ai_finish_request(uuid,text,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.ai_claim_request(uuid,text,uuid) to service_role;
grant execute on function public.ai_finish_request(uuid,text,uuid,integer,text) to service_role;

-- Mesure par appel : métadonnées uniquement, aucun prompt ni réponse.
create table if not exists public.ai_call_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  kind text not null,
  model text not null,
  tokens_in bigint not null,
  tokens_cached bigint not null,
  tokens_out bigint not null,
  tokens_thinking bigint not null,
  search_queries integer not null,
  duration_ms integer not null,
  finish_reason text,
  upstream_status integer not null
);
alter table public.ai_call_usage enable row level security;
revoke all on public.ai_call_usage from public,anon,authenticated;
grant all on public.ai_call_usage to service_role;
grant usage, select on sequence public.ai_call_usage_id_seq to service_role;
create index if not exists ai_call_usage_date on public.ai_call_usage(created_at);

-- Active les RPC seulement après la création de leurs dépendances.
update public.app_config set value=jsonb_set(value,'{optimizations_enabled}','true'::jsonb) where key='ai';
