-- Apply manually AFTER 20261010030000_lucky_lounge_shared_crash.sql.
-- Keep the completed flight and its settled players visible for 5 seconds,
-- then open the full 10-second betting window. Existing balances/bets remain.
begin;
create or replace function public.casino_crash_advance() returns public.casino_crash_flights
language plpgsql security definer set search_path='' as $$
declare f public.casino_crash_flights; next_start timestamptz; v_point numeric; r record;
begin
 select flights.* into f from public.casino_crash_lobby l join public.casino_crash_flights flights on flights.id=l.flight_id;
 if found then
  -- Preserve lock order and settle automatic cashouts/losses at the crash,
  -- regardless of how long the result remains on screen.
  perform 1 from public.casino_wallets w where exists(select 1 from public.casino_rounds b where b.user_id=w.user_id and b.game='crash' and b.status='active' and b.params->>'shared_id'=f.id::text and (clock_timestamp()>=f.ends_at or ((b.params->>'auto')::numeric<=f.point and clock_timestamp()>=f.starts_at+(ln((b.params->>'auto')::double precision)/0.1)*interval '1 second'))) order by w.user_id for update;
  for r in select user_id from public.casino_rounds where game='crash' and status='active' and params->>'shared_id'=f.id::text and (clock_timestamp()>=f.ends_at or ((params->>'auto')::numeric<=f.point and clock_timestamp()>=f.starts_at+(ln((params->>'auto')::double precision)/0.1)*interval '1 second')) order by user_id loop
   perform public.casino_sweep_crash(r.user_id);
  end loop;
  if clock_timestamp()<f.ends_at+interval '5 seconds' then return f; end if;
  next_start:=f.ends_at+interval '15 seconds';
  -- Reopening an idle lobby still gives a complete betting window.
  if next_start<=clock_timestamp() then next_start:=clock_timestamp()+interval '10 seconds'; end if;
 else next_start:=clock_timestamp()+interval '10 seconds';
 end if;
 v_point:=greatest(1,least(1000,floor(0.99/(1-public.casino_random(1000000000)::numeric/1000000000)*100)/100));
 insert into public.casino_crash_flights(starts_at,point,ends_at)
 values(next_start,v_point,next_start+(ln(v_point::double precision)/0.1)*interval '1 second') returning * into f;
 insert into public.casino_crash_lobby(singleton,flight_id) values(true,f.id) on conflict(singleton) do update set flight_id=excluded.flight_id;
 return f;
end $$;
revoke all on function public.casino_crash_advance() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
