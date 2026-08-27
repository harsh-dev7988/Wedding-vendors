-- ---------------------------------------------------------------------------
-- Venues are their own section
--
-- A venue is not the same kind of thing as a photographer. You book one venue
-- and it fixes the date, the guest count and half the budget; everything else
-- is chosen around it. Browsing them in the same list as makeup artists makes
-- the one decision that constrains all the others just another row.
--
-- So `categories` gains a kind. The vendor directory asks for 'service' and
-- the venue section asks for 'venue', which means the split is one column
-- rather than a hardcoded slug in a dozen call sites -- and a second venue-like
-- category later is a data change, not a code change.
-- ---------------------------------------------------------------------------

alter table public.categories
  add column if not exists kind text not null default 'service'
    check (kind in ('venue', 'service'));

comment on column public.categories.kind is
  'venue = browsed as its own section; service = listed in the vendor directory.';

update public.categories set kind = 'venue' where slug = 'venues';

-- ---------------------------------------------------------------------------
-- search_listings gains the filter
--
-- Dropped first: adding a parameter to a function creates an overload rather
-- than replacing it, and two candidates with the same name is exactly the
-- ambiguity PostgREST refuses to resolve.
-- ---------------------------------------------------------------------------

drop function if exists public.search_listings(
  text, text, text, integer, integer, numeric, boolean, text, integer,
  text, integer, integer, double precision, double precision
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
  origin_lng double precision default null,
  -- 'venue' or 'service'. Venues are browsed as their own section, so the
  -- vendor directory has to be able to ask for everything *except* them.
  filter_kind text default null
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
    select
      case
        when origin_lat is not null and origin_lng is not null
          and origin_lat between -90 and 90 and origin_lng between -180 and 180
        then extensions.st_setsrid(extensions.st_makepoint(origin_lng, origin_lat), 4326)::extensions.geography
        when filter_pincode is not null then (
          select extensions.st_setsrid(extensions.st_makepoint(p.longitude, p.latitude), 4326)::extensions.geography
          from public.pincodes p where p.pincode = filter_pincode
        )
      end as point,
      -- The administrative city for the pincode, when one was used.
      case
        when origin_lat is null and filter_pincode is not null then (
          select p.city_id from public.pincodes p where p.pincode = filter_pincode
        )
      end as declared_city
  ),
  -- The city a listing without a pin is judged against. The pincode's own
  -- city is authoritative; nearest centroid is the fallback for a raw
  -- coordinate, where no administrative answer exists.
  origin_city as (
    select coalesce(
      (select o.declared_city from origin o),
      (
        select c.id
        from public.cities c, origin o
        where o.point is not null and c.is_active
        order by c.geo OPERATOR(extensions.<->) o.point
        limit 1
      )
    ) as id
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
    and (filter_kind is null or cat.kind = filter_kind)
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
      -- No pin yet: fall back to the city the vendor declared, matched against
      -- the pincode's own city where there is one.
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
  text, text, text, integer, integer, numeric, boolean, text, integer,
  text, integer, integer, double precision, double precision, text
) from public;
grant execute on function public.search_listings(
  text, text, text, integer, integer, numeric, boolean, text, integer,
  text, integer, integer, double precision, double precision, text
) to anon, authenticated;
