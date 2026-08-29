-- ---------------------------------------------------------------------------
-- Split the two questions `is_active` was answering at once
--
-- The vendor form and the public navigation both read `is_active`, and they
-- want opposite things:
--
--   "may a vendor list here?"        -> yes, for every category
--   "should this appear in the menu?" -> only where there is something to see
--
-- Reading one flag for both created a loop with no way out. A mehendi artist
-- could not create a mehendi listing, because mehendi was inactive; and mehendi
-- stayed inactive because it had no listings. Every category seeded last commit
-- was stuck in it, and activating them by hand is a person standing in for a
-- rule.
--
-- So: `is_active` now means only "offer this in the public navigation", the
-- vendor side stops consulting it, and publishing a listing promotes its
-- category automatically.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. A signed-in user may see the whole taxonomy
--
-- The public still sees only what is promoted -- the existing `is_active`
-- policy is untouched, so `anon` is unchanged. A taxonomy is not sensitive; the
-- reason to keep it out of the public site is that a menu of empty categories
-- looks abandoned, not that the names are secret.
-- ---------------------------------------------------------------------------

drop policy if exists "signed in read all categories" on public.categories;
create policy "signed in read all categories"
  on public.categories for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- 2. Publishing a listing promotes its category
--
-- This is the rule that the manual activation was imitating. A category earns
-- its place in the navigation the moment somebody is actually in it, and no
-- deploy or human step sits between the two.
--
-- It does not demote. A category that empties out again keeps its place: the
-- alternative is a menu that flickers as the last listing in a city is
-- suspended and republished, and a directory page that appears and disappears
-- is worse than one that is briefly thin.
-- ---------------------------------------------------------------------------

create or replace function public.promote_category_on_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'published' then return null; end if;

  update public.categories
  set is_active = true
  where id = new.category_id and not is_active;

  return null;
end;
$$;

drop trigger if exists listings_promote_category on public.listings;
create trigger listings_promote_category
  after insert or update of status, category_id on public.listings
  for each row execute function public.promote_category_on_publish();

-- Anything already published counts, including listings that predate this.
update public.categories c
set is_active = true
where not c.is_active
  and exists (
    select 1 from public.listings l
    where l.category_id = c.id and l.status = 'published'
  );

-- ---------------------------------------------------------------------------
-- 3. The launch set
--
-- Promoted now rather than waiting for supply, so the site reads as a finished
-- directory rather than a stub. These are the categories most likely to find
-- vendors in Indian metros, and none of them needs a filter the product does
-- not already have.
--
-- The four retail categories -- bridal wear, groom wear, jewellery and
-- accessories -- stay out. They are a different purchase: a shop with stock and
-- sizes, not a business booked for a date. Listing them beside services that
-- carry a starting price and a service radius would read as broken, and they
-- should arrive with filters that suit them.
--
-- Venue subtypes stay out too. They have no route of their own until
-- `/venues/[city]/[type]` exists, so promoting them would put nine links in the
-- menu that all lead to the same page.
-- ---------------------------------------------------------------------------

update public.categories
set is_active = true
where slug in (
  'mehendi-artists',
  'djs',
  'sangeet-choreographers',
  'wedding-entertainment',
  'pandits',
  'wedding-cakes',
  'bartenders',
  'invitations',
  'wedding-favours',
  'trousseau-packers',
  'family-makeup',
  'pre-wedding-photographers',
  'beauty-and-wellness'
);
