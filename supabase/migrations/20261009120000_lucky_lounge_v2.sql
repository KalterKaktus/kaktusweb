-- Lucky Lounge V2. Run only after owner approval. No production data is deleted.
-- Atomic wallet operations, Berlin days, cryptographic eight-bit Plinko paths.
begin;

create table if not exists public.casino_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  chips bigint not null default 0 check (chips between 0 and 9007199254740991),
  rounds bigint not null default 0 check (rounds >= 0),
  biggest_win bigint not null default 0 check (biggest_win >= 0),
  total_wagered bigint check (total_wagered >= 0),
  total_won bigint check (total_won >= 0),
  tracked_wagered bigint not null default 0,
  tracked_won bigint not null default 0,
  last_claim_day date,
  revision bigint not null default 0,
  legacy_snapshot jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.casino_transactions (
  user_id uuid not null references public.casino_wallets(user_id) on delete cascade,
  request_id uuid not null,
  kind text not null check (kind in ('daily', 'plinko')),
  stake bigint not null default 0,
  payout bigint not null,
  slot integer,
  path jsonb,
  claim_day date,
  created_at timestamptz not null default clock_timestamp(),
  primary key (user_id, request_id),
  check (stake >= 0 and payout >= 0),
  check (slot is null or slot between 0 and 8)
);
create unique index if not exists casino_daily_once
  on public.casino_transactions(user_id, claim_day) where kind = 'daily';
create index if not exists casino_recent_results
  on public.casino_transactions(user_id, created_at desc) where kind = 'plinko';
alter table public.casino_wallets enable row level security;
alter table public.casino_transactions enable row level security;
revoke all on public.casino_wallets, public.casino_transactions from public, anon, authenticated;

-- Preserve the original save, including fields we cannot safely interpret.
create or replace function public.casino_legacy_integer(p_value jsonb)
returns bigint language plpgsql immutable set search_path = '' as $$
declare v numeric;
begin
  if jsonb_typeof(p_value) <> 'number' then return null; end if;
  v := (p_value #>> '{}')::numeric;
  if v < 0 or v > 9007199254740991 or v <> trunc(v) then return null; end if;
  return v::bigint;
exception when others then return null;
end $$;

create or replace function public.casino_legacy_day(p_value text)
returns date language plpgsql immutable set search_path = '' as $$
begin
  if p_value !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  return p_value::date;
exception when others then return null;
end $$;

insert into public.casino_wallets
  (user_id, chips, rounds, biggest_win, total_wagered, total_won, last_claim_day, legacy_snapshot)
select s.user_id,
  coalesce(public.casino_legacy_integer(s.payload->'chips'), 0),
  coalesce(public.casino_legacy_integer(s.payload->'spins'), 0),
  coalesce(public.casino_legacy_integer(s.payload->'biggestWin'), 0),
  public.casino_legacy_integer(s.payload->'totalWagered'),
  public.casino_legacy_integer(s.payload->'totalWon'),
  public.casino_legacy_day(s.payload->>'lastClaimDay'),
  s.payload
from public.game_saves s where s.game_id = 'lucky-lounge'
on conflict (user_id) do nothing;

-- Restrictive policies close the old client-write route, regardless of existing
-- permissive own/admin policies. Old saves stay readable and untouched.
drop policy if exists casino_legacy_no_insert on public.game_saves;
create policy casino_legacy_no_insert on public.game_saves as restrictive
  for insert to authenticated with check (game_id <> 'lucky-lounge');
drop policy if exists casino_legacy_no_update on public.game_saves;
create policy casino_legacy_no_update on public.game_saves as restrictive
  for update to authenticated using (game_id <> 'lucky-lounge') with check (game_id <> 'lucky-lounge');
drop policy if exists casino_legacy_no_delete on public.game_saves;
create policy casino_legacy_no_delete on public.game_saves as restrictive
  for delete to authenticated using (game_id <> 'lucky-lounge');

create or replace function public.casino_require_user()
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'casino_login_required'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and not is_banned) then
    raise exception 'casino_account_banned';
  end if;
  insert into public.casino_wallets(user_id, total_wagered, total_won)
    values (v_uid, 0, 0) on conflict (user_id) do nothing;
  return v_uid;
end $$;

create or replace function public.casino_snapshot(p_uid uuid)
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object(
    'wallet', to_jsonb(w) - 'legacy_snapshot' - 'user_id',
    'server_now', clock_timestamp(),
    'daily_available', w.last_claim_day is distinct from (clock_timestamp() at time zone 'Europe/Berlin')::date,
    'next_daily_at', (((clock_timestamp() at time zone 'Europe/Berlin')::date + 1)::timestamp at time zone 'Europe/Berlin'),
    'recent', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from (
      select request_id, stake, payout, slot, path, created_at
      from public.casino_transactions where user_id = p_uid and kind = 'plinko'
      order by created_at desc limit 12
    ) r), '[]'::jsonb)
  ) from public.casino_wallets w where w.user_id = p_uid;
$$;

create or replace function public.casino_get_wallet()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
  v_uid := public.casino_require_user();
  -- Serialize snapshots with mutations so revision and history agree.
  perform 1 from public.casino_wallets where user_id = v_uid for update;
  return public.casino_snapshot(v_uid);
end $$;

create or replace function public.casino_claim_daily(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_wallet public.casino_wallets; v_tx public.casino_transactions; v_day date;
begin
  if p_request_id is null then raise exception 'casino_invalid_request'; end if;
  v_uid := public.casino_require_user();
  select * into strict v_wallet from public.casino_wallets where user_id = v_uid for update;
  select * into v_tx from public.casino_transactions where user_id = v_uid and request_id = p_request_id;
  if found then
    if v_tx.kind <> 'daily' then raise exception 'casino_request_conflict'; end if;
    return public.casino_snapshot(v_uid) || jsonb_build_object('claimed', false, 'replayed', true);
  end if;
  v_day := (clock_timestamp() at time zone 'Europe/Berlin')::date;
  if v_wallet.last_claim_day is not distinct from v_day then
    return public.casino_snapshot(v_uid) || jsonb_build_object('claimed', false);
  end if;
  if v_wallet.chips > 9007199254740891 then raise exception 'casino_balance_limit'; end if;
  insert into public.casino_transactions(user_id, request_id, kind, payout, claim_day)
    values (v_uid, p_request_id, 'daily', 100, v_day);
  update public.casino_wallets set chips = chips + 100, last_claim_day = v_day, revision = revision + 1 where user_id = v_uid;
  return public.casino_snapshot(v_uid) || jsonb_build_object('claimed', true);
end $$;

create or replace function public.casino_play_plinko(p_request_id uuid, p_stake bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid; v_wallet public.casino_wallets; v_tx public.casino_transactions;
  v_random integer; v_slot integer := 0; v_path jsonb := '[]'; v_bit integer;
  v_mult numeric[] := array[0.2,0.4,0.7,1,1.2,1,0.7,0.4,0.2]; v_payout bigint;
begin
  if p_request_id is null or p_stake is null or p_stake < 1 or p_stake > 100000 then
    raise exception 'casino_invalid_bet';
  end if;
  v_uid := public.casino_require_user();
  select * into strict v_wallet from public.casino_wallets where user_id = v_uid for update;
  select * into v_tx from public.casino_transactions where user_id = v_uid and request_id = p_request_id;
  if found then
    if v_tx.kind <> 'plinko' or v_tx.stake <> p_stake then raise exception 'casino_request_conflict'; end if;
    return public.casino_snapshot(v_uid) || jsonb_build_object('round', to_jsonb(v_tx) - 'user_id', 'replayed', true);
  end if;
  if v_wallet.chips < p_stake then raise exception 'casino_insufficient_chips'; end if;
  if exists (select 1 from public.casino_transactions where user_id = v_uid and kind = 'plinko'
    and created_at > clock_timestamp() - interval '180 milliseconds') then
    raise exception 'casino_rate_limit';
  end if;
  -- First byte of a cryptographic v4 UUID: eight independent, unbiased bits.
  -- Neither the request ID nor any browser-provided seed determines the outcome.
  v_random := get_byte(decode(replace(gen_random_uuid()::text, '-', ''), 'hex'), 0);
  for i in 0..7 loop
    v_bit := (v_random >> i) & 1;
    v_slot := v_slot + v_bit;
    v_path := v_path || jsonb_build_array(v_bit);
  end loop;
  v_payout := floor(p_stake * v_mult[v_slot + 1]);
  if v_wallet.chips - p_stake + v_payout > 9007199254740991 then raise exception 'casino_balance_limit'; end if;
  insert into public.casino_transactions(user_id, request_id, kind, stake, payout, slot, path)
    values (v_uid, p_request_id, 'plinko', p_stake, v_payout, v_slot, v_path) returning * into v_tx;
  -- Stake + full payout + history in ONE transaction. Closing a tab cannot lose
  -- an unsettled win; the animation never participates in financial settlement.
  update public.casino_wallets set chips = chips - p_stake + v_payout,
    rounds = rounds + 1, biggest_win = greatest(biggest_win, v_payout),
    total_wagered = total_wagered + p_stake, total_won = total_won + v_payout,
    tracked_wagered = tracked_wagered + p_stake, tracked_won = tracked_won + v_payout,
    revision = revision + 1 where user_id = v_uid;
  return public.casino_snapshot(v_uid) || jsonb_build_object('round', to_jsonb(v_tx) - 'user_id', 'replayed', false);
end $$;

revoke all on function public.casino_legacy_integer(jsonb), public.casino_legacy_day(text), public.casino_require_user(), public.casino_snapshot(uuid),
  public.casino_get_wallet(), public.casino_claim_daily(uuid), public.casino_play_plinko(uuid,bigint) from public, anon, authenticated;
grant execute on function public.casino_get_wallet(), public.casino_claim_daily(uuid), public.casino_play_plinko(uuid,bigint) to authenticated;
commit;
