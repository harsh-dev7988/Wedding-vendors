-- ---------------------------------------------------------------------------
-- A pincode belongs to a city only if it is anywhere near one
--
-- `resolve_pincode_city` picked the nearest active city with no upper bound, so
-- every pincode in India was assigned to one of twelve metros. With the full
-- 19,550-row dataset loaded that meant a third of them sat more than 300 km
-- from the city they were said to belong to, and the worst was 1,734 km — a
-- pincode in Uttar Pradesh declared to be in Kolkata.
--
-- Nearest is not the same as near. Past a couple of hundred kilometres the
-- answer stops being "your city" and becomes "the least distant of twelve
-- places that are all a long way away", which is not something to tell a
-- visitor or to feed into a search.
--
-- `search_listings` already coalesces a null `declared_city` to the nearest
-- centroid, so nothing breaks: the search still works from the pincode's own
-- coordinates, and the only thing lost is a claim that was not true.
--
-- Two changes: a radius, and recomputation when the coordinate moves. The old
-- trigger only filled `city_id` when it was null, so re-importing corrected
-- coordinates left every previous mapping in place — the data would be fixed
-- and the mapping still wrong.
-- ---------------------------------------------------------------------------

create or replace function public.resolve_pincode_city()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Generous enough for a satellite town or the edge of a metro's sprawl,
  -- tight enough that the answer still means something.
  max_distance_m constant double precision := 200000;
  point extensions.geography;
begin
  -- Recompute whenever the coordinate is set or moves. On insert `city_id` is
  -- normally null anyway; on update it is whatever the row already held, and
  -- keeping that would preserve a mapping the new coordinate disagrees with.
  point := extensions.st_setsrid(
    extensions.st_makepoint(new.longitude, new.latitude), 4326
  )::extensions.geography;

  select c.id into new.city_id
  from public.cities c
  where c.is_active
    and extensions.st_dwithin(c.geo, point, max_distance_m)
  order by c.geo OPERATOR(extensions.<->) point
  limit 1;

  return new;
end;
$$;

drop trigger if exists pincodes_resolve_city on public.pincodes;
create trigger pincodes_resolve_city
  before insert or update of latitude, longitude on public.pincodes
  for each row execute function public.resolve_pincode_city();

-- Re-resolve everything already loaded under the old rule. Touching the
-- coordinate with its own value is enough to fire the trigger.
update public.pincodes set latitude = latitude;
