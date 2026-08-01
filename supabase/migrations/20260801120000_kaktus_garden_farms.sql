-- =============================================================================
-- KaktusGarden: sichere öffentliche Farm-Snapshots für Besuche.
--
-- Der rohe game_saves.payload bleibt privat. Die View veröffentlicht nur die
-- 16 Felder sowie harmlose Anzeige-/Presence-Daten. Inventare, Währungen,
-- Shopbestand und Statistiken anderer Spieler werden nie exponiert.
-- =============================================================================

drop view if exists public.kaktus_garden_farms;

create view public.kaktus_garden_farms
  with (security_invoker = false)
as
  select
    gs.user_id,
    coalesce(nullif(trim(p.username), ''), gs.display_name, 'Spieler') as display_name,
    p.avatar_url,
    case
      when coalesce(gs.payload ->> 'level', '') ~ '^[0-9]{1,8}$'
        then greatest(1, least(9999, (gs.payload ->> 'level')::int))
      else 1
    end as level,
    gs.updated_at,
    up.last_seen,
    coalesce(up.last_seen > now() - interval '2 minutes', false) as is_online,
    jsonb_build_object(
      'playerId', gs.user_id::text,
      'gridSize', jsonb_build_object('columns', 4, 'rows', 4),
      'fields', gs.payload -> 'fields',
      'capturedAt', (extract(epoch from gs.updated_at) * 1000)::bigint
    ) as farm_snapshot
  from public.game_saves gs
  join public.profiles p on p.id = gs.user_id
  left join public.user_presence up on up.user_id = gs.user_id
  where gs.game_id = 'kaktus-garden'
    and coalesce(p.is_banned, false) = false
    and jsonb_typeof(gs.payload -> 'fields') = 'array'
    and jsonb_array_length(gs.payload -> 'fields') = 16;

grant select on public.kaktus_garden_farms to anon, authenticated;

comment on view public.kaktus_garden_farms is
  'Öffentliche read-only KaktusGarden-Farmansicht. Exponiert bewusst keine '
  'Währungen, Inventare, Shopdaten oder privaten Profilfelder. Zukünftige '
  'Interaktionen wie Ernte-Diebstahl müssen über eine serverseitig validierte '
  'RPC laufen und dürfen diese View nicht beschreibbar machen.';
