-- Multi-attribute search, pincode/geo, filter indexes, phone verification,
-- and a tighter burst rate limit.

-- Radius search without PostGIS. `earthdistance` plus a GiST index on
-- `ll_to_earth` is the standard approach and is far lighter than PostGIS for
-- what is only ever a "within N km" query.
create extension if not exists cube with schema extensions;
create extension if not exists earthdistance with schema extensions;

-- ---------------------------------------------------------------------------
-- Geo and phone columns
-- ---------------------------------------------------------------------------

alter table public.listings
  add column pincode text check (pincode is null or pincode ~ '^[1-9][0-9]{5}$'),
  -- Populated by geocoding the pincode; radius search is skipped when null.
  add column latitude double precision check (latitude is null or latitude between -90 and 90),
  add column longitude double precision check (longitude is null or longitude between -180 and 180);

alter table public.profiles
  add column phone_e164 text unique check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  add column phone_verified_at timestamptz;

-- Indian pincode → coordinates. Seeded from a public dataset; a listing is
-- geocoded from its pincode rather than asking a vendor for coordinates.
create table public.pincodes (
  pincode text primary key check (pincode ~ '^[1-9][0-9]{5}$'),
  district text,
  state_name text,
  latitude double precision not null,
  longitude double precision not null,
  city_id uuid references public.cities (id) on delete set null
);

alter table public.pincodes enable row level security;
grant select on public.pincodes to anon, authenticated;
create policy "public pincodes" on public.pincodes for select using (true);

create index pincodes_city_idx on public.pincodes (city_id);
create index pincodes_earth_idx on public.pincodes
  using gist (extensions.ll_to_earth(latitude, longitude));

-- ---------------------------------------------------------------------------
-- Filter indexes
--
-- Every one is partial on `status = 'published'`: the public directory never
-- looks at anything else, so indexing drafts and rejected rows is pure waste.
-- ---------------------------------------------------------------------------

create index listings_price_idx on public.listings (price_from)
  where status = 'published' and price_from is not null;

create index listings_rating_idx on public.listings (rating_avg desc nulls last, rating_count desc)
  where status = 'published';

create index listings_experience_idx on public.listings (years_experience desc nulls last)
  where status = 'published';

create index listings_response_idx on public.listings (response_minutes asc nulls last)
  where status = 'published';

-- The composite that serves the common query: city + category, filtered and
-- sorted by price.
create index listings_facet_idx on public.listings
  (primary_city_id, category_id, price_from, rating_avg desc nulls last)
  where status = 'published';

create index listings_pincode_idx on public.listings (pincode)
  where status = 'published' and pincode is not null;

create index listings_earth_idx on public.listings
  using gist (extensions.ll_to_earth(latitude, longitude))
  where status = 'published' and latitude is not null;

-- ---------------------------------------------------------------------------
-- Multi-attribute search
-- ---------------------------------------------------------------------------

/**
 * The directory query, as one function.
 *
 * PostgREST could express the old three-filter version, but not faceted price
 * and rating ranges combined with radius and a keyword — that needed `.or()`
 * strings built by concatenation, which is both fragile and unindexable.
 *
 * Security INVOKER on purpose: RLS still applies, so `anon` sees exactly what
 * the `public published listings` policy allows. The explicit status and
 * vendor-approval predicates below are belt and braces on top of that.
 *
 * `count(*) over ()` gives the total in the same scan rather than a second
 * round trip.
 */
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
             extensions.ll_to_earth(l.latitude, l.longitude))
      end
    end asc nulls last,
    l.published_at desc nulls last,
    l.id
  limit greatest(1, least(coalesce(page_limit, 24), 60))
  offset greatest(0, coalesce(page_offset, 0));
$$;

revoke all on function public.search_listings(text, text, text, integer, integer, numeric, boolean, text, integer, text, integer, integer) from public;
grant execute on function public.search_listings(text, text, text, integer, integer, numeric, boolean, text, integer, text, integer, integer) to anon, authenticated;

/** Price and rating bounds for a facet panel, so the UI never invents ranges. */
create or replace function public.listing_facets(
  filter_city text default null,
  filter_category text default null
)
returns table (
  min_price integer,
  max_price integer,
  rated_count bigint,
  verified_count bigint,
  total bigint
)
language sql
stable
set search_path = ''
as $$
  select
    min(l.price_from), max(l.price_from),
    count(*) filter (where l.rating_count > 0),
    count(*) filter (where v.verified_at is not null and v.verification_expires_at > now()),
    count(*)
  from public.listings l
  join public.vendors v on v.id = l.vendor_id
  join public.cities c on c.id = l.primary_city_id
  join public.categories cat on cat.id = l.category_id
  where l.status = 'published'
    and v.status = 'approved'
    and (filter_city is null or c.slug = filter_city)
    and (filter_category is null or cat.slug = filter_category);
$$;

revoke all on function public.listing_facets(text, text) from public;
grant execute on function public.listing_facets(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Phone verification
-- ---------------------------------------------------------------------------

/**
 * Record a verified phone number against the caller's profile.
 *
 * Called only after Supabase Auth has verified the OTP, so this records the
 * outcome rather than performing the check. The uniqueness constraint on
 * `profiles.phone_e164` stops one number being used to farm accounts.
 */
create or replace function public.record_verified_phone(requested_phone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if requested_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Phone must use E.164 format' using errcode = '22023';
  end if;

  update public.profiles
  set phone_e164 = requested_phone, phone_verified_at = now()
  where id = auth.uid();
exception when unique_violation then
  raise exception 'That number is already verified on another account'
    using errcode = 'P0001';
end;
$$;

revoke all on function public.record_verified_phone(text) from public, anon;
grant execute on function public.record_verified_phone(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Tighter burst rate limit
-- ---------------------------------------------------------------------------

/**
 * Replaces the 5-per-24-hours cap with a burst window plus a daily ceiling.
 *
 * A genuine customer shortlists and contacts several vendors in one sitting,
 * so a flat daily cap of five punished normal behaviour while still allowing a
 * slow drip of spam. Five per ten minutes stops scripted bursts; twenty per day
 * remains the outer bound.
 */
create or replace function public.submit_enquiry_and_reveal(
  requested_listing_id uuid,
  requested_event_date date,
  requested_message text,
  requested_guest_count integer default null
)
returns table (lead_id uuid, phone text, email_address text, whatsapp text, revealed_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  matched_vendor_id uuid;
  created_lead_id uuid;
  reveal_time timestamptz := now();
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 941));

  if requested_event_date < public.india_today() then
    raise exception 'Event date must be today or later' using errcode = '22023';
  end if;
  if char_length(trim(requested_message)) < 20 or char_length(requested_message) > 2000 then
    raise exception 'Message must contain 20 to 2000 characters' using errcode = '22023';
  end if;
  if requested_guest_count is not null and requested_guest_count not between 1 and 100000 then
    raise exception 'Guest count is outside the accepted range' using errcode = '22023';
  end if;

  if (select count(*) from public.leads
      where customer_id = current_user_id
        and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'Enquiry burst limit reached' using errcode = 'P0001';
  end if;
  if (select count(*) from public.leads
      where customer_id = current_user_id
        and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'Daily enquiry limit reached' using errcode = 'P0001';
  end if;

  select l.vendor_id into matched_vendor_id
  from public.listings l
  join public.vendors v on v.id = l.vendor_id
  where l.id = requested_listing_id and l.status = 'published' and v.status = 'approved';

  if matched_vendor_id is null then
    raise exception 'Listing is not available' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.vendor_contacts where vendor_id = matched_vendor_id) then
    raise exception 'Vendor contact is not available' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.leads
    where customer_id = current_user_id
      and listing_id = requested_listing_id
      and created_at > now() - interval '15 minutes'
  ) then
    raise exception 'Please wait before sending another enquiry to this vendor' using errcode = 'P0001';
  end if;

  insert into public.leads (listing_id, customer_id, event_date, guest_count, message)
  values (requested_listing_id, current_user_id, requested_event_date, requested_guest_count, trim(requested_message))
  returning id into created_lead_id;

  insert into public.contact_reveals (lead_id, customer_id, vendor_id, revealed_at, last_viewed_at, view_count)
  values (created_lead_id, current_user_id, matched_vendor_id, reveal_time, reveal_time, 1);

  return query
  select created_lead_id, c.phone_e164, c.email, c.whatsapp_e164, reveal_time
  from public.vendor_contacts c where c.vendor_id = matched_vendor_id;
end;
$$;

-- Vendors set their own pincode, so it needs a column grant.
grant update (pincode, latitude, longitude) on public.listings to authenticated;
