-- Manual, after the Lucky Lounge decimal-chip migration. No balances are reset.
-- Only the existing, authenticated Netlify Admin API may grant virtual chips.
begin;

create table if not exists public.casino_admin_credits (
  request_id uuid primary key,
  user_id uuid not null references public.casino_wallets(user_id) on delete cascade,
  admin_id uuid references auth.users(id) on delete set null,
  amount numeric(22,2) not null check (amount between 0.01 and 1000000),
  balance_after numeric(22,2) not null,
  revision bigint not null,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists casino_admin_credits_by_user
  on public.casino_admin_credits(user_id, created_at desc);
alter table public.casino_admin_credits enable row level security;
revoke all on public.casino_admin_credits from public, anon, authenticated;
grant select on public.casino_wallets, public.casino_admin_credits to service_role;

create or replace function public.casino_admin_grant_chips(
  p_request_id uuid, p_user_id uuid, p_admin_id uuid, p_amount numeric
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  w public.casino_wallets;
  credit public.casino_admin_credits;
  replayed boolean := false;
begin
  if p_request_id is null or p_user_id is null or p_admin_id is null then
    raise exception 'casino_invalid_request';
  end if;
  if p_amount is null or p_amount < 0.01 or p_amount > 1000000
    or p_amount <> trunc(p_amount, 2) then
    raise exception 'casino_invalid_credit';
  end if;
  -- Serialize request IDs even if a retry changes its target account.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('casino_admin_credit:' || p_request_id::text, 0)
  );
  select * into credit from public.casino_admin_credits where request_id = p_request_id;
  if found then
    if credit.user_id <> p_user_id or credit.admin_id is distinct from p_admin_id
      or credit.amount <> p_amount then
      raise exception 'casino_request_conflict';
    end if;
    replayed := true;
  else
    if not exists (select 1 from public.profiles where id = p_user_id)
      or not exists (select 1 from auth.users where id = p_admin_id) then
      raise exception 'casino_invalid_user';
    end if;
    insert into public.casino_wallets(user_id, total_wagered, total_won)
      values (p_user_id, 0, 0) on conflict (user_id) do nothing;
    select * into strict w from public.casino_wallets where user_id = p_user_id for update;
    if w.chips > 9007199254740991 - p_amount then
      raise exception 'casino_balance_limit';
    end if;
    update public.casino_wallets set chips = chips + p_amount, revision = revision + 1
      where user_id = p_user_id returning * into w;
    insert into public.casino_admin_credits(request_id, user_id, admin_id, amount, balance_after, revision)
      values (p_request_id, p_user_id, p_admin_id, p_amount, w.chips, w.revision)
      returning * into credit;
  end if;
  -- Replay returns the current balance, including any rounds played since the credit.
  select * into strict w from public.casino_wallets where user_id = p_user_id;
  return jsonb_build_object('wallet', to_jsonb(w) - 'legacy_snapshot',
    'credit', to_jsonb(credit), 'replayed', replayed);
end $$;

revoke all on function public.casino_admin_grant_chips(uuid, uuid, uuid, numeric)
  from public, anon, authenticated;
grant execute on function public.casino_admin_grant_chips(uuid, uuid, uuid, numeric)
  to service_role;
notify pgrst, 'reload schema';
commit;
