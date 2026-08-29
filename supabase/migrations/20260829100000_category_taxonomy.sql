-- ---------------------------------------------------------------------------
-- The full category taxonomy
--
-- Five categories become thirty-two, arranged in thirteen groups. The shape
-- follows the market's convention (WedMeGood's own menu) because that is what
-- Indian couples and vendors already recognise, but two of theirs are left out
-- deliberately:
--
--   * "Virtual planning / Genie" is their own paid service, not a vendor
--     category. Listing it would advertise a product that does not exist here.
--   * "Pre-wedding shoot locations" is a directory of *places*. This product is
--     built entirely on enquiry then validated contact reveal; a location has
--     no contact to reveal, no plan and no leads. It is a different content
--     type wearing a category's clothes.
--
-- Their sub-facets are also not categories. Their own URLs say so:
-- `/bridal-wear/all/bridal-lehenga-stores` is a filter on bridal wear, while
-- `/banquet-hall` is a route. Thirteen of their forty-seven entries are facets,
-- and importing them as categories would create routes nothing should own.
-- Facets can hang off `parent_slug` later.
-- ---------------------------------------------------------------------------

alter table public.categories
  add column if not exists group_name text not null default 'Other',
  add column if not exists group_slug text not null default 'other',
  add column if not exists group_sort integer not null default 100,
  add column if not exists description text,
  -- Venue subtypes point at `venues`. Nothing enforces a single level, but
  -- nothing walks more than one either.
  add column if not exists parent_slug text
    references public.categories (slug) on delete set null,
  -- Which units this category may price in. A caterer should never be offered
  -- "rental" and a jeweller should never be offered "per plate"; leaving that
  -- to a global list is how a form ends up describing a shop as a service.
  add column if not exists allowed_price_units public.price_unit[]
    not null default array['on_request']::public.price_unit[];

comment on column public.categories.parent_slug is
  'Set for a subtype, e.g. banquet-halls under venues. NULL for a top-level category.';
comment on column public.categories.allowed_price_units is
  'Price units this category may use. The listing form offers only these.';

-- `categories` uses column-level grants, so a new column is readable by nobody
-- until it is granted — which is exactly how four pages ended up 404ing last
-- week. `npm run db:grants` checks for this now; the grant still has to be here.
grant select (group_name, group_slug, group_sort, description, parent_slug, allowed_price_units)
  on public.categories to anon, authenticated;

create index if not exists categories_group_idx
  on public.categories (group_sort, sort_order);
create index if not exists categories_parent_idx
  on public.categories (parent_slug) where parent_slug is not null;

-- ---------------------------------------------------------------------------
-- Group the five that already exist
--
-- Their slugs do not change. They are referenced by `listings.category_id`, and
-- their directory URLs are indexed; renaming them to match another site's
-- vocabulary would break both for no gain.
-- ---------------------------------------------------------------------------

update public.categories set
  group_name = 'Venues', group_slug = 'venues', group_sort = 10, sort_order = 10,
  description = 'Banquet halls, lawns, resorts, hotels and destination spaces.',
  allowed_price_units = array['per_plate','per_event','package','on_request']::public.price_unit[]
where slug = 'venues';

update public.categories set
  group_name = 'Photography', group_slug = 'photography', group_sort = 20, sort_order = 10,
  description = 'Wedding, candid, cinematic and pre-wedding teams.',
  allowed_price_units = array['per_event','per_day','package','on_request']::public.price_unit[]
where slug = 'photographers';

update public.categories set
  group_name = 'Makeup', group_slug = 'makeup', group_sort = 30, sort_order = 10,
  description = 'Bridal hair and makeup, airbrush and HD.',
  allowed_price_units = array['per_event','per_function','per_person','package','on_request']::public.price_unit[]
where slug = 'makeup-artists';

update public.categories set
  group_name = 'Food', group_slug = 'food', group_sort = 80, sort_order = 10,
  description = 'Multi-cuisine caterers, live counters and full-service teams.',
  allowed_price_units = array['per_plate','per_event','package','on_request']::public.price_unit[]
where slug = 'caterers';

-- Planning and decor were one combined category here and are two everywhere
-- else, because they are two purchases: a planner runs the day, a decorator
-- builds the set, and vendors rarely do both well. It holds no listings, so
-- splitting it now costs nothing; splitting it later would mean moving them.
-- It stays in the table, inactive, so its indexed URLs can redirect rather
-- than 404.
update public.categories set
  is_active = false,
  group_name = 'Planning & Decor', group_slug = 'planning-decor',
  group_sort = 40, sort_order = 99,
  description = 'Superseded by Wedding Planners and Decorators.'
where slug = 'planners-decorators';

-- ---------------------------------------------------------------------------
-- The rest
--
-- Everything new arrives inactive. A menu offering thirty-two categories where
-- thirty are empty makes a working site look abandoned, and the supply gate
-- that keeps thin pages out of Google does nothing for the person looking at
-- the menu. Activate a category when there are vendors in it.
-- ---------------------------------------------------------------------------

insert into public.categories
  (name, slug, kind, is_active, sort_order, group_name, group_slug, group_sort, parent_slug, description, allowed_price_units)
values
  -- Venues -------------------------------------------------------------------
  ('Banquet halls', 'banquet-halls', 'venue', false, 20, 'Venues', 'venues', 10, 'venues',
   'Indoor halls for receptions and ceremonies.',
   array['per_plate','per_event','package','on_request']::public.price_unit[]),
  ('Marriage lawns', 'marriage-lawns', 'venue', false, 30, 'Venues', 'venues', 10, 'venues',
   'Open-air lawns and garden venues.',
   array['per_plate','per_event','package','on_request']::public.price_unit[]),
  ('Wedding resorts', 'wedding-resorts', 'venue', false, 40, 'Venues', 'venues', 10, 'venues',
   'Resorts with rooms, grounds and in-house catering.',
   array['per_plate','per_event','package','on_request']::public.price_unit[]),
  ('Small function halls', 'small-function-halls', 'venue', false, 50, 'Venues', 'venues', 10, 'venues',
   'Intimate spaces for roka, mehendi and haldi.',
   array['per_plate','per_event','package','on_request']::public.price_unit[]),
  ('Destination venues', 'destination-venues', 'venue', false, 60, 'Venues', 'venues', 10, 'venues',
   'Palaces, beaches and hill stations for a travelling wedding.',
   array['per_event','package','on_request']::public.price_unit[]),
  ('Kalyana mandapams', 'kalyana-mandapams', 'venue', false, 70, 'Venues', 'venues', 10, 'venues',
   'Traditional South Indian wedding halls.',
   array['per_plate','per_event','package','on_request']::public.price_unit[]),
  ('Wedding hotels', 'wedding-hotels', 'venue', false, 80, 'Venues', 'venues', 10, 'venues',
   'Four-star and above hotels with banquet space.',
   array['per_plate','per_event','package','on_request']::public.price_unit[]),
  ('Luxury hotels', 'luxury-hotels', 'venue', false, 90, 'Venues', 'venues', 10, 'venues',
   'Five-star hotels and luxury collections.',
   array['per_plate','per_event','package','on_request']::public.price_unit[]),
  ('Farmhouses', 'farmhouses', 'venue', false, 100, 'Venues', 'venues', 10, 'venues',
   'Private farmhouses and estates on city outskirts.',
   array['per_plate','per_event','package','on_request']::public.price_unit[]),

  -- Photography --------------------------------------------------------------
  ('Pre-wedding photographers', 'pre-wedding-photographers', 'service', false, 20,
   'Photography', 'photography', 20, null,
   'Couple shoots before the wedding, on location or in studio.',
   array['per_event','per_day','package','on_request']::public.price_unit[]),

  -- Makeup -------------------------------------------------------------------
  ('Family makeup', 'family-makeup', 'service', false, 20, 'Makeup', 'makeup', 30, null,
   'Hair and makeup for the family and the bridal party.',
   array['per_person','per_function','package','on_request']::public.price_unit[]),

  -- Planning & Decor ---------------------------------------------------------
  ('Wedding planners', 'wedding-planners', 'service', false, 10,
   'Planning & Decor', 'planning-decor', 40, null,
   'Full-service planners who run the day end to end.',
   array['per_event','package','on_request']::public.price_unit[]),
  ('Decorators', 'decorators', 'service', false, 20,
   'Planning & Decor', 'planning-decor', 40, null,
   'Mandap, stage, floral and lighting design.',
   array['per_event','per_function','package','on_request']::public.price_unit[]),

  -- Mehndi -------------------------------------------------------------------
  ('Mehendi artists', 'mehendi-artists', 'service', false, 10, 'Mehndi', 'mehndi', 50, null,
   'Bridal and guest mehendi, traditional and contemporary.',
   array['per_person','per_function','per_event','on_request']::public.price_unit[]),

  -- Music & Dance ------------------------------------------------------------
  ('DJs', 'djs', 'service', false, 10, 'Music & Dance', 'music-dance', 60, null,
   'DJs and sound for sangeet and reception.',
   array['per_event','per_function','per_day','on_request']::public.price_unit[]),
  ('Sangeet choreographers', 'sangeet-choreographers', 'service', false, 20,
   'Music & Dance', 'music-dance', 60, null,
   'Choreography and rehearsals for family performances.',
   array['per_function','per_event','package','on_request']::public.price_unit[]),
  ('Wedding entertainment', 'wedding-entertainment', 'service', false, 30,
   'Music & Dance', 'music-dance', 60, null,
   'Live bands, dhol, folk performers and anchors.',
   array['per_event','per_function','on_request']::public.price_unit[]),

  -- Invites & Gifts ----------------------------------------------------------
  ('Invitations', 'invitations', 'service', false, 10,
   'Invites & Gifts', 'invites-gifts', 70, null,
   'Printed and digital wedding invitations.',
   array['per_piece','package','on_request']::public.price_unit[]),
  ('Wedding favours', 'wedding-favours', 'service', false, 20,
   'Invites & Gifts', 'invites-gifts', 70, null,
   'Return gifts, hampers and mehndi favours.',
   array['per_piece','package','on_request']::public.price_unit[]),
  ('Trousseau packers', 'trousseau-packers', 'service', false, 30,
   'Invites & Gifts', 'invites-gifts', 70, null,
   'Gift and trousseau packing and presentation.',
   array['per_piece','package','on_request']::public.price_unit[]),

  -- Food ---------------------------------------------------------------------
  ('Wedding cakes', 'wedding-cakes', 'service', false, 20, 'Food', 'food', 80, null,
   'Tiered cakes, desserts and dessert tables.',
   array['per_kg','per_piece','on_request']::public.price_unit[]),
  ('Bartenders', 'bartenders', 'service', false, 30, 'Food', 'food', 80, null,
   'Bar service, mixologists and beverage counters.',
   array['per_event','per_day','per_person','on_request']::public.price_unit[]),

  -- Bridal wear --------------------------------------------------------------
  ('Bridal wear', 'bridal-wear', 'service', false, 10, 'Bridal Wear', 'bridal-wear', 90, null,
   'Lehengas, sarees and gowns to buy or rent.',
   array['per_piece','rental','on_request']::public.price_unit[]),

  -- Groom wear ---------------------------------------------------------------
  ('Groom wear', 'groom-wear', 'service', false, 10, 'Groom Wear', 'groom-wear', 100, null,
   'Sherwanis, suits and tuxedos to buy or rent.',
   array['per_piece','rental','on_request']::public.price_unit[]),

  -- Jewellery & accessories --------------------------------------------------
  ('Jewellery', 'jewellery', 'service', false, 10,
   'Jewellery & Accessories', 'jewellery-accessories', 110, null,
   'Bridal sets, polki, temple and flower jewellery.',
   array['per_piece','rental','on_request']::public.price_unit[]),
  ('Accessories', 'accessories', 'service', false, 20,
   'Jewellery & Accessories', 'jewellery-accessories', 110, null,
   'Footwear, clutches, turbans, kalire and dupattas.',
   array['per_piece','on_request']::public.price_unit[]),

  -- Pandits ------------------------------------------------------------------
  ('Wedding pandits', 'pandits', 'service', false, 10, 'Pandits', 'pandits', 120, null,
   'Priests for the ceremony, in the tradition you follow.',
   array['per_function','per_event','on_request']::public.price_unit[]),

  -- Bridal grooming ----------------------------------------------------------
  ('Beauty and wellness', 'beauty-and-wellness', 'service', false, 10,
   'Bridal Grooming', 'bridal-grooming', 130, null,
   'Salons, skin and hair treatments and pre-wedding programmes.',
   array['per_person','package','on_request']::public.price_unit[])
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Keep the shape honest
--
-- A subtype must belong to a category that exists, and must share its kind: a
-- venue subtype under a service parent would appear in one section and be
-- queried from the other.
-- ---------------------------------------------------------------------------

create or replace function public.check_category_parent()
returns trigger
language plpgsql
as $$
declare
  parent_kind text;
begin
  if new.parent_slug is null then return new; end if;

  if new.parent_slug = new.slug then
    raise exception 'A category cannot be its own parent' using errcode = '22023';
  end if;

  select kind into parent_kind from public.categories where slug = new.parent_slug;
  if parent_kind is null then
    raise exception 'Unknown parent category %', new.parent_slug using errcode = '22023';
  end if;
  if parent_kind <> new.kind then
    raise exception
      'Category % is %, but its parent % is % — a subtype must share its parent kind',
      new.slug, new.kind, new.parent_slug, parent_kind
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists categories_check_parent on public.categories;
create trigger categories_check_parent
  before insert or update on public.categories
  for each row execute function public.check_category_parent();
