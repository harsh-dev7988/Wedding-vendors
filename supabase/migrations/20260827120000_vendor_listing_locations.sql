-- ---------------------------------------------------------------------------
-- Batch location read for the vendor dashboard
--
-- `get_listing_location(uuid)` answers for one listing, which would mean one
-- round trip per row on a page that lists all of a vendor's listings. This
-- returns every location the caller is entitled to in a single call.
--
-- Same protection as the single-row version: `geo` is granted to nobody, so
-- the only way to read it is through a definer function that checks
-- membership. A column grant could not express "only your own", because the
-- listings SELECT policy also matches every published listing.
-- ---------------------------------------------------------------------------

create or replace function public.get_vendor_listing_locations()
returns table (
  listing_id uuid,
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
    l.id,
    extensions.st_y(l.geo::extensions.geometry),
    extensions.st_x(l.geo::extensions.geometry),
    l.street_address,
    l.service_radius_m
  from public.listings l
  where public.is_vendor_member(l.vendor_id) or public.is_admin();
$$;

revoke all on function public.get_vendor_listing_locations() from public, anon;
grant execute on function public.get_vendor_listing_locations() to authenticated;
