-- =============================================================================
-- Nachzieher zu 20260525120000_security_hardening.sql:
--   Der DROP von profiles_select_leaderboard hat in Production nicht den
--   raw-Read auf profiles unterbunden — es gibt offenbar eine weitere SELECT-
--   Policy mit unbekanntem Namen (eventuell aus dem Supabase Dashboard von
--   Hand angelegt). Black-Box-Test zeigt: jeder authenticated User kann immer
--   noch is_banned, total_xp, vip, vip_color, recent_xp_*, donation_* etc.
--   aller anderen User lesen.
--
-- Strategie: Catch-all — alle SELECT-Policies auf public.profiles enumerieren
-- und droppen, AUSSER profiles_select_own. Danach gibt es garantiert nur noch
-- den own-Read auf raw profiles. Alle Leaderboards lesen ohnehin aus
-- profiles_public (Safe-View).
--
-- Idempotent: kann beliebig oft laufen.
-- =============================================================================

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and cmd = 'SELECT'
      and policyname <> 'profiles_select_own'
  loop
    execute format('drop policy if exists %I on public.profiles', pol.policyname);
    raise notice 'dropped profiles SELECT policy: %', pol.policyname;
  end loop;
end
$$;

-- profiles_select_own neu setzen falls aus Versehen mit gedroppt
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'profiles_select_own'
  ) then
    create policy profiles_select_own
      on public.profiles
      for select
      to authenticated
      using (auth.uid() = id);
  end if;
end
$$;

-- Sicherstellen dass profiles_public als SECURITY DEFINER View läuft
-- (sodass sie die geblockten raw-profiles trotzdem für Leaderboards lesen kann).
-- security_invoker=false ist Default in PG ≥15 aber wir setzen es explizit für
-- Klarheit und Schutz gegen spätere Versions-Upgrades.
do $$
begin
  if exists (
    select 1 from pg_views where schemaname = 'public' and viewname = 'profiles_public'
  ) then
    execute 'alter view public.profiles_public set (security_invoker = false)';
  end if;
end
$$;
