-- Backfill: top_entries in game_season_archives haben historisch keinen user_id.
-- Wir matchen den archivierten Namen gegen profiles.username (display_name in
-- game_saves wird per Trigger auf username gezwungen → eindeutiger Match möglich).
-- Damit kann das Frontend für "letzter Monat" die AKTUELLEN Profil-Werte
-- (Level, Badge, VIP-Farbe) für die Top-3 anzeigen, während Score und Rang
-- historisch bleiben.

update public.game_season_archives a
set top_entries = (
    select coalesce(jsonb_agg(
        case
            when p.id is not null and not (elem.value ? 'user_id') then
                jsonb_set(elem.value, '{user_id}', to_jsonb(p.id))
            else elem.value
        end
        order by elem.idx
    ), '[]'::jsonb)
    from jsonb_array_elements(a.top_entries) with ordinality as elem(value, idx)
    left join public.profiles p on p.username = elem.value->>'name'
)
where a.game_id = 'kaktus-clicker'
  and jsonb_array_length(a.top_entries) > 0;
