-- =============================================================================
-- Economy V3: Initial-Save-Cap für den Clicker anheben (1e7 → 1e12).
--
-- Der Trigger game_saves_initial_cap (20260525200000) bannt Accounts < 24 h,
-- deren Save über dem Spiel-Limit liegt. Das alte Limit von 10 Mio. Cactus war
-- gegen die ALTE Economy kalibriert. Mit Economy V3 (CPS-Buff, Tier-Upgrades,
-- stärkeres Prestige) erreicht ein ehrlicher Vielspieler laut Simulation am
-- ersten Tag bis zu ~5e10 — das alte Limit hätte legitime Neulinge gebannt.
--
-- 1e12 lässt Faktor ~20 Luft über dem simulierten Tag-1-Optimum und fängt
-- weiterhin das eigentliche Ziel: Leute, die sich per localStorage-Injection
-- direkt mit Fantasiewerten (1e15+) einbuchen.
--
-- Idempotent: create or replace + drop/create Trigger.
-- =============================================================================

create or replace function public.game_saves_initial_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  account_age interval;
  is_new boolean;
  fishing_limit constant numeric := 1000;
  clicker_limit constant numeric := 1000000000000;  -- 1 Bio. (Economy V3)
  effective_limit numeric;
begin
  select now() - u.created_at into account_age
  from auth.users u
  where u.id = NEW.user_id;

  is_new := coalesce(account_age, interval '999 days') < interval '24 hours';

  if not is_new then
    return NEW;
  end if;

  if NEW.game_id = 'my-fishing-kaktus' then
    effective_limit := fishing_limit;
  elsif NEW.game_id = 'kaktus-clicker' then
    effective_limit := clicker_limit;
  else
    return NEW;
  end if;

  if NEW.total_earned > effective_limit then
    begin
      perform public.log_cheat_flag(
        NEW.user_id,
        'new_account_high_score',
        'critical',
        jsonb_build_object(
          'game_id', NEW.game_id,
          'total_earned', NEW.total_earned,
          'limit', effective_limit,
          'account_age_hours', extract(epoch from account_age) / 3600
        )
      );
    exception when others then
      raise notice 'log_cheat_flag failed: %', sqlerrm;
    end;
    raise exception 'new_account_high_score' using
      hint = format('Neuer Account (%s alt) versucht direkt total_earned=%s — limit=%s',
                    account_age, NEW.total_earned, effective_limit);
  end if;

  return NEW;
end;
$$;

drop trigger if exists game_saves_initial_cap_trigger on public.game_saves;
create trigger game_saves_initial_cap_trigger
  before insert on public.game_saves
  for each row
  execute function public.game_saves_initial_cap();
