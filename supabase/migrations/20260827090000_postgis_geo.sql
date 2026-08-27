-- ---------------------------------------------------------------------------
-- PostGIS: exact locations, vendor service radii, nearest-city resolution
--
-- Replaces the cube/earthdistance pair with a real geography type, a real
-- spatial index, and ST_DWithin. The privacy shape is unchanged and is the
-- point of the whole design: the exact point goes in, only a *distance* and a
-- *locality label* ever come out.
--
-- PostGIS lives in `extensions`, so every symbol below is schema-qualified —
-- these functions run with `search_path = ''` and would not resolve otherwise.
-- ---------------------------------------------------------------------------

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

alter table public.listings
  -- The exact point. Never granted to anon, and never granted to authenticated
  -- either: the SELECT policy lets any signed-in user read published listings,
  -- so a column grant here would publish every venue's coordinates to anyone
  -- with an account. Vendors read their own through get_listing_location().
  add column if not exists geo extensions.geography(Point, 4326),
  -- Captured for moderation. Same reasoning: never publicly readable.
  add column if not exists street_address text
    check (street_address is null or char_length(street_address) <= 500),
  -- How far this business will travel. NULL means a fixed location — a venue
  -- is somewhere you go to, so a service radius is meaningless for one.
  add column if not exists service_radius_m integer
    check (service_radius_m is null or service_radius_m between 1000 and 200000);

alter table public.cities
  add column if not exists geo extensions.geography(Point, 4326);

-- ---------------------------------------------------------------------------
-- Backfill
-- ---------------------------------------------------------------------------

update public.listings
set geo = extensions.st_setsrid(
            extensions.st_makepoint(longitude, latitude), 4326
          )::extensions.geography
where geo is null and latitude is not null and longitude is not null;

-- Metro centroids. A fixed, verifiable list rather than a geocoding call that
-- can fail or drift.
update public.cities c set geo = extensions.st_setsrid(
    extensions.st_makepoint(v.lng, v.lat), 4326
  )::extensions.geography
from (values
  ('ahmedabad',  23.0225, 72.5714),
  ('bengaluru',  12.9716, 77.5946),
  ('chandigarh', 30.7333, 76.7794),
  ('chennai',    13.0827, 80.2707),
  ('delhi-ncr',  28.6139, 77.2090),
  ('hyderabad',  17.3850, 78.4867),
  ('jaipur',     26.9124, 75.7873),
  ('kochi',       9.9312, 76.2673),
  ('kolkata',    22.5726, 88.3639),
  ('mumbai',     19.0760, 72.8777),
  ('pune',       18.5204, 73.8567),
  ('surat',      21.1702, 72.8311)
) as v(slug, lat, lng)
where c.slug = v.slug;

-- Existing listings take the 30 km default, except venues, which are fixed.
update public.listings l
set service_radius_m = 30000
where l.service_radius_m is null
  and exists (
    select 1 from public.categories cat
    where cat.id = l.category_id and cat.slug <> 'venues'
  );

create index if not exists listings_geo_idx on public.listings using gist (geo);
create index if not exists cities_geo_idx on public.cities using gist (geo);

-- ---------------------------------------------------------------------------
-- `geo` becomes the source of truth; latitude/longitude follow it
--
-- Kept in sync rather than dropped, so anything still reading the old columns
-- keeps working through the transition instead of silently seeing nulls.
-- ---------------------------------------------------------------------------

create or replace function public.sync_listing_latlng()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.geo is null then
    new.latitude := null;
    new.longitude := null;
  else
    new.latitude := extensions.st_y(new.geo::extensions.geometry);
    new.longitude := extensions.st_x(new.geo::extensions.geometry);
  end if;
  return new;
end;
$$;

drop trigger if exists listings_sync_latlng on public.listings;
create trigger listings_sync_latlng
  before insert or update of geo on public.listings
  for each row execute function public.sync_listing_latlng();

-- ---------------------------------------------------------------------------
-- Grants
--
-- `service_radius_m` is public: "travels up to 30 km" is useful to a customer
-- and reveals nothing. `geo` and `street_address` are granted to nobody.
-- ---------------------------------------------------------------------------

grant select (service_radius_m) on public.listings to anon, authenticated;

-- `cities` carried a table-level SELECT grant, so the new column inherited
-- public read. A column-level REVOKE cannot carve a column out of a
-- table-level grant in Postgres — the table grant has to go and be replaced by
-- an explicit column list. Centroids are not themselves secret; the rule is
-- that geometry is never a public column, so the next column added here does
-- not leak by default the way this one did.
revoke select on public.cities from anon, authenticated;
grant select (id, name, slug, state_name, is_active, sort_order, created_at)
  on public.cities to anon, authenticated;
grant insert (geo, street_address, service_radius_m) on public.listings to authenticated;
grant update (geo, street_address, service_radius_m) on public.listings to authenticated;

-- ---------------------------------------------------------------------------
-- Reading back your own location
--
-- A vendor editing a listing has to see the pin they dropped. A column grant
-- cannot express "only your own", because the SELECT policy also matches every
-- published listing — so this is a function, scoped the same way
-- get_revealed_contact() is.
-- ---------------------------------------------------------------------------

create or replace function public.get_listing_location(requested_listing_id uuid)
returns table (
  latitude double precision,
  longitude double precision,
  street_address text,
  service_radius_m integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    extensions.st_y(l.geo::extensions.geometry),
    extensions.st_x(l.geo::extensions.geometry),
    l.street_address,
    l.service_radius_m
  from public.listings l
  where l.id = requested_listing_id
    and (public.is_vendor_member(l.vendor_id) or public.is_admin());
$$;

revoke all on function public.get_listing_location(uuid) from public, anon;
grant execute on function public.get_listing_location(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Nearest supported city
--
-- Definer rights so it can read `cities.geo`, which is not publicly granted.
-- `<->` is the GiST KNN operator: an index-ordered nearest-neighbour scan
-- rather than a distance computed for every row.
-- ---------------------------------------------------------------------------

create or replace function public.get_nearest_city(
  origin_lat double precision,
  origin_lng double precision
)
returns table (id uuid, name text, slug text, distance_km double precision)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.name,
    c.slug,
    round(
      (extensions.st_distance(
        c.geo,
        extensions.st_setsrid(extensions.st_makepoint(origin_lng, origin_lat), 4326)::extensions.geography
      ) / 1000)::numeric, 1
    )::double precision
  from public.cities c
  where c.is_active and c.geo is not null
    and origin_lat between -90 and 90
    and origin_lng between -180 and 180
  -- `OPERATOR(extensions.<->)` rather than a bare `<->`: this function runs
  -- with an empty search_path, so an unqualified operator cannot resolve.
  order by c.geo OPERATOR(extensions.<->) extensions.st_setsrid(
    extensions.st_makepoint(origin_lng, origin_lat), 4326
  )::extensions.geography
  limit 1;
$$;

revoke all on function public.get_nearest_city(double precision, double precision) from public;
grant execute on function public.get_nearest_city(double precision, double precision) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- search_listings, on PostGIS
--
-- Signature changes (adds an explicit lat/lng origin), so the old one is
-- dropped rather than overloaded.
--
-- Eligibility rule: a *mobile* listing matches when the search point is inside
-- **the vendor's** radius — they will travel to you. A *fixed* listing (a
-- venue) matches when it is inside **the customer's** radius — you travel to
-- it. Getting this backwards either hides vendors who would happily come, or
-- lists ones who will refuse.
-- ---------------------------------------------------------------------------

drop function if exists public.search_listings(
  text, text, text, integer, integer, numeric, boolean, text, integer, text, integer, integer
);

create or replace function public.search_listings(
  filter_city text default null,
  filter_category text default null,
  filter_query text default null,
  filter_min_price integer default null,
  filter_max_price integer default null,
  filter_min_rating numeric default null,
  filter_verified_only boolean default false,
  filter_pincode text default null,
  filter_radius_km integer default null,
  sort_by text default 'recent',
  page_limit integer default 24,
  page_offset integer default 0,
  origin_lat double precision default null,
  origin_lng double precision default null
)
returns table (
  id uuid,
  slug text,
  title text,
  summary text,
  locality text,
  pincode text,
  price_from integer,
  price_unit public.price_unit,
  years_experience smallint,
  rating_avg numeric,
  rating_count integer,
  response_minutes integer,
  city_name text,
  city_slug text,
  category_name text,
  category_slug text,
  vendor_id uuid,
  verified boolean,
  cover_path text,
  cover_alt text,
  distance_km double precision,
  service_radius_m integer,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with origin as (
    -- An explicit coordinate wins over a pincode, so "near me" is exact rather
    -- than snapped to a postcode centroid.
    select case
      when origin_lat is not null and origin_lng is not null
        and origin_lat between -90 and 90 and origin_lng between -180 and 180
      then extensions.st_setsrid(extensions.st_makepoint(origin_lng, origin_lat), 4326)::extensions.geography
      when filter_pincode is not null then (
        select extensions.st_setsrid(extensions.st_makepoint(p.longitude, p.latitude), 4326)::extensions.geography
        from public.pincodes p where p.pincode = filter_pincode
      )
    end as point
  ),
  -- The city nearest the search point. Used as the fallback for listings that
  -- have no pin yet: we still know the city the vendor declared.
  origin_city as (
    select c.id
    from public.cities c, origin o
    where o.point is not null and c.is_active and c.geo is not null
    order by c.geo OPERATOR(extensions.<->) o.point
    limit 1
  ),
  -- The search term is used as a literal, never spliced into a filter grammar.
  term as (select nullif(btrim(coalesce(filter_query, '')), '') as q)
  select
    l.id, l.slug, l.title, l.summary, l.locality, l.pincode,
    l.price_from, l.price_unit, l.years_experience,
    l.rating_avg, l.rating_count, l.response_minutes,
    c.name, c.slug, cat.name, cat.slug,
    v.id,
    (v.verified_at is not null and v.verification_expires_at > now()) as verified,
    m.storage_path, m.alt_text,
    case
      when o.point is null or l.geo is null then null
      else round((extensions.st_distance(l.geo, o.point) / 1000)::numeric, 1)::double precision
    end as distance_km,
    l.service_radius_m,
    count(*) over () as total_count
  from public.listings l
  join public.vendors v on v.id = l.vendor_id
  join public.cities c on c.id = l.primary_city_id
  join public.categories cat on cat.id = l.category_id
  left join lateral (
    select lm.storage_path, lm.alt_text
    from public.listing_media lm
    where lm.listing_id = l.id
    order by lm.sort_order
    limit 1
  ) m on true
  left join origin o on true
  cross join term t
  where l.status = 'published'
    and v.status = 'approved'
    and (filter_city is null or c.slug = filter_city)
    and (filter_category is null or cat.slug = filter_category)
    and (filter_min_price is null or l.price_from >= filter_min_price)
    and (filter_max_price is null or (l.price_from is not null and l.price_from <= filter_max_price))
    and (filter_min_rating is null or (l.rating_count > 0 and l.rating_avg >= filter_min_rating))
    and (not filter_verified_only
         or (v.verified_at is not null and v.verification_expires_at > now()))
    and (
      t.q is null
      or l.title ilike '%' || t.q || '%'
      or l.summary ilike '%' || t.q || '%'
      or l.locality ilike '%' || t.q || '%'
    )
    and (
      o.point is null
      -- No pin yet: fall back to the city the vendor declared. Returning a
      -- Delhi venue for a Mumbai search is worse than omitting an unpinned
      -- listing from a neighbouring city, and hiding it entirely would punish
      -- vendors who onboarded before the map existed.
      or (l.geo is null and l.primary_city_id = (select id from origin_city))
      or (
        l.service_radius_m is not null
        and extensions.st_dwithin(l.geo, o.point, l.service_radius_m)
      )
      or (
        l.service_radius_m is null
        and extensions.st_dwithin(l.geo, o.point, coalesce(filter_radius_km, 25) * 1000.0)
      )
    )
    -- The customer's own narrowing filter, applied on top of eligibility.
    and (
      filter_radius_km is null or o.point is null or l.geo is null
      or extensions.st_dwithin(l.geo, o.point, filter_radius_km * 1000.0)
    )
  order by
    case when sort_by = 'price_asc'  then l.price_from end asc nulls last,
    case when sort_by = 'price_desc' then l.price_from end desc nulls last,
    case when sort_by = 'rating'     then l.rating_avg end desc nulls last,
    case when sort_by = 'experience' then l.years_experience end desc nulls last,
    case when sort_by = 'response'   then l.response_minutes end asc nulls last,
    case when sort_by = 'distance'   then
      case when o.point is null or l.geo is null then null
      else extensions.st_distance(l.geo, o.point) end
    end asc nulls last,
    l.published_at desc nulls last,
    l.id
  limit greatest(1, least(coalesce(page_limit, 24), 60))
  offset greatest(0, coalesce(page_offset, 0));
$$;

revoke all on function public.search_listings(
  text, text, text, integer, integer, numeric, boolean, text, integer, text,
  integer, integer, double precision, double precision
) from public;
grant execute on function public.search_listings(
  text, text, text, integer, integer, numeric, boolean, text, integer, text,
  integer, integer, double precision, double precision
) to anon, authenticated;
