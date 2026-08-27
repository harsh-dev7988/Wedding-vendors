-- ---------------------------------------------------------------------------
-- A city without a centroid is a silent trap
--
-- `get_nearest_city` skips cities whose `geo` is null, so inserting one without
-- a centroid does not fail — it quietly routes anyone using "use my location"
-- in that city to a *different* city entirely. Proven: a centroid-less test row
-- for Indore resolved locals to Ahmedabad, with no error anywhere.
--
-- All twelve existing rows already have a centroid, so this costs nothing and
-- converts a silent misroute into an immediate insert failure.
-- ---------------------------------------------------------------------------

alter table public.cities
  alter column geo set not null;
