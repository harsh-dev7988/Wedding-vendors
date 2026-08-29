-- ---------------------------------------------------------------------------
-- Remove pincodes whose coordinate cannot be where it claims
--
-- The importer now drops these before writing, using the median of a pincode's
-- own post offices and then checking it against its three-digit sorting
-- district. This clears the ones an earlier run already wrote: an upsert
-- corrects a row, it does not remove one that should never have existed.
--
-- The rule is the dataset checked against itself. A three-digit prefix is a
-- postal sorting district and is genuinely compact, so a pincode sitting 200 km
-- from its district's median is not a large district — it is a bad coordinate,
-- and it is the kind that quietly attaches a whole pincode to the wrong end of
-- the country.
--
-- Harmless on a database that never ran the old importer: it deletes nothing.
-- ---------------------------------------------------------------------------

with district_centre as (
  select
    left(pincode, 3) as prefix,
    percentile_cont(0.5) within group (order by latitude) as lat,
    percentile_cont(0.5) within group (order by longitude) as lng
  from public.pincodes
  group by left(pincode, 3)
)
delete from public.pincodes p
using district_centre d
where d.prefix = left(p.pincode, 3)
  and extensions.st_distance(
        extensions.st_setsrid(extensions.st_makepoint(p.longitude, p.latitude), 4326)::extensions.geography,
        extensions.st_setsrid(extensions.st_makepoint(d.lng, d.lat), 4326)::extensions.geography
      ) > 200000;
