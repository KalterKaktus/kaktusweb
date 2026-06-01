-- =============================================================================
-- Skin/Cosmetics System für KaktusClicker (VIP-only)
--
-- Speicher pro User in profiles.cosmetics als jsonb:
--   { head: { id: 'sombrero', color: '#d97706' },
--     eyes: { id: 'sunglasses', color: '#000000' },
--     accessory: { id: 'mustache', color: '#451a03' } }
--
-- Werte (id strings) werden client-seitig gegen ein Whitelist gerendert.
-- Unbekannte IDs → kein Render (silent ignore).
-- Setting cosmetics nur via RPC set_cosmetics() die VIP voraussetzt.
-- =============================================================================

-- 1. Spalte
alter table public.profiles
  add column if not exists cosmetics jsonb not null default '{}'::jsonb;

-- 2. set_cosmetics RPC: VIP-Gate + bypass für profiles_protect_columns
create or replace function public.set_cosmetics(p_cosmetics jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  is_vip boolean;
begin
  if uid is null then
    raise exception 'auth_required';
  end if;
  if p_cosmetics is null or jsonb_typeof(p_cosmetics) <> 'object' then
    raise exception 'cosmetics_must_be_object';
  end if;

  select vip into is_vip from profiles where id = uid;
  if coalesce(is_vip, false) <> true then
    raise exception 'vip_required';
  end if;

  -- profiles_protect_columns Trigger respektiert app.profile_bypass — sonst
  -- würde er cosmetics-Updates evtl. blocken (er resettet aktuell viele
  -- Spalten, cosmetics ist nicht in der Liste aber zur Sicherheit).
  perform set_config('app.profile_bypass', 'true', true);
  update public.profiles
    set cosmetics = p_cosmetics, updated_at = now()
    where id = uid;
  perform set_config('app.profile_bypass', 'false', true);

  return p_cosmetics;
end;
$$;

revoke all on function public.set_cosmetics(jsonb) from public, anon;
grant execute on function public.set_cosmetics(jsonb) to authenticated;

-- 3. profiles_public View erweitern: cosmetics + vip ist eh schon drin.
-- Wir wollen cosmetics für ANDERE User sichtbar machen (z.B. wenn wir
-- später cactus-rendering im Leaderboard hätten). Aktuell nur fürs eigene
-- Profil relevant — wir lesen via profiles_select_own.
-- Falls später needed: alter view profiles_public und füge cosmetics column hinzu.
