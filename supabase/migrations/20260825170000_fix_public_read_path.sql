-- ---------------------------------------------------------------------------
-- Repairs the public read path.
--
-- Two later migrations added columns to `public.listings` without extending
-- the column-scoped grant that `anon` reads through:
--
--   20260825140000  response_minutes, response_sample_size
--   20260825150000  pincode, latitude, longitude
--
-- Everything that touches one of them has been failing with
-- "permission denied for table listings" ever since. The application treats a
-- query error as "no results", so the failure was invisible: the directory and
-- every vendor page silently fell back to the preview fixtures instead of
-- showing live listings.
-- ---------------------------------------------------------------------------

-- Safe to expose: all three are already rendered on a public listing card.
grant select (pincode, response_minutes, response_sample_size)
  on public.listings to anon, authenticated;

-- `latitude` and `longitude` are deliberately NOT granted. A vendor's exact
-- coordinates are close to a home address for the many businesses run from
-- one; radius search reads them inside the function below and returns only a
-- distance, never the point itself.

-- `search_listings` runs the whole directory. It was security invoker, so it
-- inherited the caller's column grants and could not read latitude/longitude
-- at all — which is why it failed even for a query with no radius filter.
--
-- Definer rights are safe here because the row filter is unconditional
-- (`l.status = 'published' and v.status = 'approved'`, neither of which
-- depends on a parameter) and every returned column is one the public listing
-- card already shows. The coordinates stay inside the function.
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
  page_offset integer default 0
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
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with origin as (
    select p.latitude as lat, p.longitude as lng
    from public.pincodes p
    where filter_pincode is not null and p.pincode = filter_pincode
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
      when o.lat is null or l.latitude is null then null
      else extensions.earth_distance(
             extensions.ll_to_earth(o.lat, o.lng),
             extensions.ll_to_earth(l.latitude, l.longitude)
           ) / 1000.0
    end as distance_km,
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
      filter_radius_km is null or o.lat is null or l.latitude is null
      or extensions.earth_box(extensions.ll_to_earth(o.lat, o.lng), filter_radius_km * 1000.0)
         OPERATOR(extensions.@>) extensions.ll_to_earth(l.latitude, l.longitude)
    )
  order by
    case when sort_by = 'price_asc'  then l.price_from end asc nulls last,
    case when sort_by = 'price_desc' then l.price_from end desc nulls last,
    case when sort_by = 'rating'     then l.rating_avg end desc nulls last,
    case when sort_by = 'experience' then l.years_experience end desc nulls last,
    case when sort_by = 'response'   then l.response_minutes end asc nulls last,
    case when sort_by = 'distance'   then
      case when o.lat is null or l.latitude is null then null
      else extensions.earth_distance(
             extensions.ll_to_earth(o.lat, o.lng),
             extensions.ll_to_earth(l.latitude, l.longitude)
           )
      end
    end asc nulls last,
    l.published_at desc nulls last,
    l.id
  limit greatest(1, least(coalesce(page_limit, 24), 60))
  offset greatest(0, coalesce(page_offset, 0));
$$;

revoke all on function public.search_listings(
  text, text, text, integer, integer, numeric, boolean, text, integer, text, integer, integer
) from public;
grant execute on function public.search_listings(
  text, text, text, integer, integer, numeric, boolean, text, integer, text, integer, integer
) to anon, authenticated;
