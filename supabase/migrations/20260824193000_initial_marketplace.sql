create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create type public.vendor_status as enum ('draft', 'pending_review', 'approved', 'suspended', 'archived');
create type public.listing_status as enum ('draft', 'pending_review', 'published', 'rejected', 'suspended', 'archived');
create type public.vendor_member_role as enum ('owner', 'manager', 'editor', 'lead_manager');
create type public.price_unit as enum ('per_plate', 'per_event', 'per_function', 'per_day', 'package', 'on_request');
create type public.lead_status as enum ('new', 'viewed', 'contacted', 'qualified', 'closed', 'spam');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  state_name text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  business_name text not null check (char_length(business_name) between 2 and 160),
  legal_name text,
  status public.vendor_status not null default 'draft',
  verified_at timestamptz,
  verification_expires_at timestamptz,
  moderated_by uuid references auth.users (id) on delete set null,
  moderated_at timestamptz,
  moderation_note text check (moderation_note is null or char_length(moderation_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vendor_members (
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.vendor_member_role not null default 'editor',
  created_at timestamptz not null default now(),
  primary key (vendor_id, user_id)
);

-- This table must never be joined into public listing queries. It has no grant
-- for `anon` and no customer-select policy; the only customer path to its
-- values is `submit_enquiry_and_reveal` / `get_revealed_contact`.
--
-- The E.164 and email patterns below use a single backslash. Postgres ships
-- `standard_conforming_strings = on`, so a doubled backslash would make these
-- match a literal backslash instead of `+` or `.` and would reject every real
-- phone number and email address.
create table public.vendor_contacts (
  vendor_id uuid primary key references public.vendors (id) on delete cascade,
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  whatsapp_e164 text check (whatsapp_e164 is null or whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  updated_at timestamptz not null default now(),
  check (phone_e164 is not null or email is not null)
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  category_id uuid not null references public.categories (id),
  primary_city_id uuid not null references public.cities (id),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 2 and 160),
  summary text not null check (char_length(summary) between 20 and 320),
  description text not null check (char_length(description) between 50 and 10000),
  locality text,
  price_from integer check (price_from is null or price_from >= 0),
  price_unit public.price_unit not null default 'on_request',
  currency text not null default 'INR' check (currency = 'INR'),
  years_experience smallint check (years_experience between 0 and 100),
  status public.listing_status not null default 'draft',
  -- Trigger-maintained so public queries never embed an unbounded review set.
  rating_avg numeric(2, 1) check (rating_avg is null or rating_avg between 1 and 5),
  rating_count integer not null default 0 check (rating_count >= 0),
  -- `published_at` is the first publication and is never cleared: nulling it on
  -- suspension destroyed the original date and let a suspend/republish cycle
  -- jump a listing to the top of `order by published_at desc`.
  published_at timestamptz,
  unpublished_at timestamptz,
  suspended_by_cascade boolean not null default false,
  moderated_by uuid references auth.users (id) on delete set null,
  moderated_at timestamptz,
  moderation_note text check (moderation_note is null or char_length(moderation_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Retains redirect history so a renamed listing keeps its inbound links.
create table public.listing_slug_history (
  slug text primary key check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.listing_service_areas (
  listing_id uuid not null references public.listings (id) on delete cascade,
  city_id uuid not null references public.cities (id) on delete cascade,
  primary key (listing_id, city_id)
);

create table public.listing_media (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  storage_path text not null unique,
  alt_text text not null check (char_length(alt_text) between 5 and 240),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.pricing_options (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  description text,
  amount integer check (amount is null or amount >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  unit public.price_unit not null default 'package',
  is_active boolean not null default true,
  sort_order integer not null default 0
);

-- `customer_id` is nullable and `on delete set null` so an auth user can be
-- erased (DPDP) without destroying the vendor's lead history or the reveal
-- audit trail. RLS compares `customer_id = auth.uid()`, and null never matches.
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id),
  customer_id uuid references auth.users (id) on delete set null,
  event_date date not null,
  guest_count integer check (guest_count is null or guest_count between 1 and 100000),
  message text not null check (char_length(message) between 20 and 2000),
  status public.lead_status not null default 'new',
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  from_status public.lead_status,
  to_status public.lead_status not null,
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.contact_reveals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.leads (id) on delete cascade,
  customer_id uuid references auth.users (id) on delete set null,
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  revealed_at timestamptz not null default now(),
  last_viewed_at timestamptz,
  view_count integer not null default 0 check (view_count >= 0)
);

create table public.shortlists (
  customer_id uuid not null references auth.users (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, listing_id)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.leads (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  customer_id uuid references auth.users (id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 30 and 3000),
  is_published boolean not null default false,
  vendor_reply text check (vendor_reply is null or char_length(vendor_reply) between 2 and 2000),
  moderated_by uuid references auth.users (id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Search is per-column `ilike`, so the trigram indexes must be per column too.
-- A GIN index over `title || ' ' || summary` could never be matched by those
-- predicates and left every keyword search on a sequential scan.
create index listings_title_trgm_idx on public.listings using gin (title extensions.gin_trgm_ops);
create index listings_summary_trgm_idx on public.listings using gin (summary extensions.gin_trgm_ops);
create index listings_locality_trgm_idx on public.listings using gin (locality extensions.gin_trgm_ops);
-- Serves the default directory ordering, which filters status only.
create index listings_published_idx on public.listings (status, published_at desc);
create index listings_discovery_idx on public.listings (primary_city_id, category_id, status, published_at desc);
create index listings_vendor_idx on public.listings (vendor_id);
create index listing_slug_history_listing_idx on public.listing_slug_history (listing_id);
create index listing_service_areas_city_idx on public.listing_service_areas (city_id, listing_id);
create index listing_media_listing_idx on public.listing_media (listing_id, sort_order);
-- `is_vendor_member` and the dashboard both filter on the caller, not the PK.
create index vendor_members_user_idx on public.vendor_members (user_id);
create index leads_customer_created_idx on public.leads (customer_id, created_at desc);
create index leads_listing_created_idx on public.leads (listing_id, created_at desc);
create index lead_events_lead_idx on public.lead_events (lead_id, created_at desc);
create index contact_reveals_customer_idx on public.contact_reveals (customer_id, revealed_at desc);
create index reviews_listing_published_idx on public.reviews (listing_id, is_published, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- Event dates are Indian calendar dates. Comparing them against a UTC "today"
-- rejected valid same-day enquiries for the 5.5 hours after midnight IST.
create or replace function public.india_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Kolkata')::date;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_roles where user_id = auth.uid());
$$;

create or replace function public.is_vendor_member(check_vendor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vendor_members
    where vendor_id = check_vendor_id and user_id = auth.uid()
  );
$$;

-- Membership alone was previously enough for every vendor-side write, so the
-- four roles in `vendor_member_role` carried no authority. Each policy now
-- names the roles it accepts.
create or replace function public.has_vendor_role(
  check_vendor_id uuid,
  allowed public.vendor_member_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vendor_members
    where vendor_id = check_vendor_id
      and user_id = auth.uid()
      and role = any(allowed)
  );
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger vendors_touch before update on public.vendors for each row execute function public.touch_updated_at();
create trigger vendor_contacts_touch before update on public.vendor_contacts for each row execute function public.touch_updated_at();
create trigger listings_touch before update on public.listings for each row execute function public.touch_updated_at();
create trigger leads_touch before update on public.leads for each row execute function public.touch_updated_at();
create trigger reviews_touch before update on public.reviews for each row execute function public.touch_updated_at();

-- Keeps the public rating aggregate in step with moderation decisions.
create or replace function public.refresh_listing_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  -- `NEW` is unassigned in an AFTER DELETE trigger, so it must not be read.
  if tg_op = 'DELETE' then
    target := old.listing_id;
  else
    target := new.listing_id;
  end if;

  update public.listings l
  set rating_avg = agg.avg_rating,
      rating_count = agg.total
  from (
    select round(avg(rating)::numeric, 1) as avg_rating,
           count(*)::integer as total
    from public.reviews
    where listing_id = target and is_published
  ) agg
  where l.id = target;
  return null;
end;
$$;

-- Scoped to the columns that can change the aggregate, so a vendor reply does
-- not trigger a recount.
create trigger reviews_rating_sync
after insert or delete or update of rating, is_published, listing_id on public.reviews
for each row execute function public.refresh_listing_rating();

-- Records the previous slug so old URLs can be redirected rather than 404ed.
create or replace function public.record_listing_slug_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.slug is distinct from old.slug then
    delete from public.listing_slug_history where slug = new.slug;
    insert into public.listing_slug_history (slug, listing_id)
    values (old.slug, new.id)
    on conflict (slug) do update set listing_id = excluded.listing_id;
  end if;
  return new;
end;
$$;

create trigger listings_slug_history
after update of slug on public.listings
for each row execute function public.record_listing_slug_change();

-- Lead status changes are recorded as append-only events.
create or replace function public.record_lead_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.lead_events (lead_id, from_status, to_status, actor_id)
    values (new.id, null, new.status, new.customer_id);
  elsif new.status is distinct from old.status then
    insert into public.lead_events (lead_id, from_status, to_status, actor_id)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return null;
end;
$$;

create trigger leads_event_log
after insert or update of status on public.leads
for each row execute function public.record_lead_event();

revoke all on function public.india_today() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_vendor_member(uuid) from public;
revoke all on function public.has_vendor_role(uuid, public.vendor_member_role[]) from public;
grant execute on function public.india_today() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_vendor_member(uuid) to anon, authenticated;
grant execute on function public.has_vendor_role(uuid, public.vendor_member_role[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.admin_roles enable row level security;
alter table public.cities enable row level security;
alter table public.categories enable row level security;
alter table public.vendors enable row level security;
alter table public.vendor_members enable row level security;
alter table public.vendor_contacts enable row level security;
alter table public.listings enable row level security;
alter table public.listing_slug_history enable row level security;
alter table public.listing_service_areas enable row level security;
alter table public.listing_media enable row level security;
alter table public.pricing_options enable row level security;
alter table public.leads enable row level security;
alter table public.lead_events enable row level security;
alter table public.contact_reveals enable row level security;
alter table public.shortlists enable row level security;
alter table public.reviews enable row level security;
alter table public.audit_logs enable row level security;

revoke all on all tables in schema public from anon, authenticated;
-- Future tables inherit the deny-by-default posture instead of relying on the
-- one-off revoke above.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

grant select on public.cities, public.categories, public.listing_slug_history, public.listing_service_areas, public.pricing_options to anon, authenticated;
-- Every public-facing grant below is column-scoped. A full-table grant would
-- expose reviewer and moderator auth user ids, internal moderation notes and
-- takedown timestamps to anyone holding the browser-visible publishable key.
grant select (id, business_name, status, verified_at, verification_expires_at, created_at, updated_at) on public.vendors to anon, authenticated;
grant select (id, vendor_id, category_id, primary_city_id, slug, title, summary, description, locality, price_from, price_unit, currency, years_experience, status, rating_avg, rating_count, published_at, created_at, updated_at) on public.listings to anon, authenticated;
grant select (id, listing_id, rating, body, vendor_reply, is_published, created_at) on public.reviews to anon, authenticated;
grant select (id, listing_id, storage_path, alt_text, sort_order) on public.listing_media to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.vendor_members, public.vendor_contacts to authenticated;
-- `customer_id` is included because the account page filters on it, and a
-- WHERE clause requires SELECT privilege on the column.
grant select (id, listing_id, customer_id, event_date, guest_count, message, status, anonymized_at, created_at, updated_at) on public.leads to authenticated;
grant select (id, lead_id, from_status, to_status, created_at) on public.lead_events to authenticated;
grant select (id, lead_id, vendor_id, revealed_at, last_viewed_at, view_count) on public.contact_reveals to authenticated;
grant select on public.audit_logs to authenticated;
grant insert, update, delete on public.vendor_contacts, public.listing_service_areas, public.listing_media, public.pricing_options to authenticated;
grant insert, delete on public.listings to authenticated;
grant update (category_id, primary_city_id, slug, title, summary, description, locality, price_from, price_unit, years_experience, status, updated_at) on public.listings to authenticated;
grant update (business_name, legal_name, updated_at) on public.vendors to authenticated;
grant update (status, updated_at) on public.leads to authenticated;
grant update (vendor_reply, updated_at) on public.reviews to authenticated;
grant select, insert, update, delete on public.shortlists to authenticated;

create policy "profiles own read" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles own update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "public active cities" on public.cities for select using (is_active);
create policy "public active categories" on public.categories for select using (is_active);

create policy "public approved vendors" on public.vendors for select using (status = 'approved' or public.is_vendor_member(id) or public.is_admin());
create policy "owners update vendor profile" on public.vendors for update to authenticated
  using (public.has_vendor_role(id, array['owner', 'manager']::public.vendor_member_role[]) or public.is_admin())
  with check (public.has_vendor_role(id, array['owner', 'manager']::public.vendor_member_role[]) or public.is_admin());

create policy "members read memberships" on public.vendor_members for select to authenticated using (user_id = auth.uid() or public.is_vendor_member(vendor_id) or public.is_admin());

create policy "members read contacts" on public.vendor_contacts for select to authenticated using (public.has_vendor_role(vendor_id, array['owner', 'manager']::public.vendor_member_role[]) or public.is_admin());
create policy "owners manage contacts" on public.vendor_contacts for all to authenticated
  using (public.has_vendor_role(vendor_id, array['owner', 'manager']::public.vendor_member_role[]) or public.is_admin())
  with check (public.has_vendor_role(vendor_id, array['owner', 'manager']::public.vendor_member_role[]) or public.is_admin());

-- A published listing is only public while its vendor is approved. Relying on
-- the moderation cascade alone left any listing published by another path
-- visible after its vendor was suspended.
create policy "public published listings" on public.listings for select using (
  (status = 'published' and exists (select 1 from public.vendors v where v.id = vendor_id and v.status = 'approved'))
  or public.is_vendor_member(vendor_id)
  or public.is_admin()
);
create policy "members insert listings" on public.listings for insert to authenticated
  with check ((public.has_vendor_role(vendor_id, array['owner', 'manager', 'editor']::public.vendor_member_role[]) and status in ('draft', 'pending_review')) or public.is_admin());
-- `using` excludes 'suspended' so a suspended listing cannot be moved back to
-- draft by the party that was suspended. 'rejected' stays editable so a vendor
-- can address the feedback and resubmit.
create policy "members update listings" on public.listings for update to authenticated
  using ((public.has_vendor_role(vendor_id, array['owner', 'manager', 'editor']::public.vendor_member_role[]) and status <> 'suspended') or public.is_admin())
  with check ((public.has_vendor_role(vendor_id, array['owner', 'manager', 'editor']::public.vendor_member_role[]) and status in ('draft', 'pending_review', 'archived')) or public.is_admin());
create policy "members delete draft listings" on public.listings for delete to authenticated
  using ((public.has_vendor_role(vendor_id, array['owner', 'manager']::public.vendor_member_role[]) and status = 'draft') or public.is_admin());

create policy "public slug history" on public.listing_slug_history for select using (
  exists (select 1 from public.listings l join public.vendors v on v.id = l.vendor_id where l.id = listing_id and l.status = 'published' and v.status = 'approved')
);

create policy "public published service areas" on public.listing_service_areas for select using (exists (select 1 from public.listings where id = listing_id and status = 'published'));
create policy "members manage service areas" on public.listing_service_areas for all to authenticated
  using (exists (select 1 from public.listings where id = listing_id and public.has_vendor_role(vendor_id, array['owner', 'manager', 'editor']::public.vendor_member_role[])) or public.is_admin())
  with check (exists (select 1 from public.listings where id = listing_id and public.has_vendor_role(vendor_id, array['owner', 'manager', 'editor']::public.vendor_member_role[])) or public.is_admin());

create policy "public published media" on public.listing_media for select using (exists (select 1 from public.listings where id = listing_id and status = 'published'));
create policy "members manage media" on public.listing_media for all to authenticated
  using (exists (select 1 from public.listings where id = listing_id and public.has_vendor_role(vendor_id, array['owner', 'manager', 'editor']::public.vendor_member_role[])) or public.is_admin())
  with check (exists (select 1 from public.listings where id = listing_id and public.has_vendor_role(vendor_id, array['owner', 'manager', 'editor']::public.vendor_member_role[])) or public.is_admin());

create policy "public published pricing" on public.pricing_options for select using (is_active and exists (select 1 from public.listings where id = listing_id and status = 'published'));
create policy "members manage pricing" on public.pricing_options for all to authenticated
  using (exists (select 1 from public.listings where id = listing_id and public.has_vendor_role(vendor_id, array['owner', 'manager', 'editor']::public.vendor_member_role[])) or public.is_admin())
  with check (exists (select 1 from public.listings where id = listing_id and public.has_vendor_role(vendor_id, array['owner', 'manager', 'editor']::public.vendor_member_role[])) or public.is_admin());

create policy "customers read own leads" on public.leads for select to authenticated using (customer_id = auth.uid() or public.is_admin() or exists (select 1 from public.listings where id = listing_id and public.is_vendor_member(vendor_id)));
create policy "vendors update assigned leads" on public.leads for update to authenticated
  using (public.is_admin() or exists (select 1 from public.listings where id = listing_id and public.has_vendor_role(vendor_id, array['owner', 'manager', 'lead_manager']::public.vendor_member_role[])))
  with check (public.is_admin() or exists (select 1 from public.listings where id = listing_id and public.has_vendor_role(vendor_id, array['owner', 'manager', 'lead_manager']::public.vendor_member_role[])));

create policy "participants read lead events" on public.lead_events for select to authenticated using (
  public.is_admin() or exists (
    select 1 from public.leads l
    where l.id = lead_id and (l.customer_id = auth.uid() or exists (select 1 from public.listings li where li.id = l.listing_id and public.is_vendor_member(li.vendor_id)))
  )
);

create policy "customers read own reveal audits" on public.contact_reveals for select to authenticated using (customer_id = auth.uid() or public.is_admin() or public.is_vendor_member(vendor_id));

create policy "customers read own shortlist" on public.shortlists for select to authenticated using (customer_id = auth.uid());
create policy "customers add own shortlist" on public.shortlists for insert to authenticated with check (customer_id = auth.uid() and exists (select 1 from public.listings l join public.vendors v on v.id = l.vendor_id where l.id = listing_id and l.status = 'published' and v.status = 'approved'));
create policy "customers remove own shortlist" on public.shortlists for delete to authenticated using (customer_id = auth.uid());
create policy "customers maintain own shortlist" on public.shortlists for update to authenticated using (customer_id = auth.uid()) with check (customer_id = auth.uid());

create policy "public published reviews" on public.reviews for select using (is_published or customer_id = auth.uid() or public.is_admin() or exists (select 1 from public.listings where id = listing_id and public.is_vendor_member(vendor_id)));
create policy "vendors reply to reviews" on public.reviews for update to authenticated
  using (public.is_admin() or exists (select 1 from public.listings where id = listing_id and public.has_vendor_role(vendor_id, array['owner', 'manager', 'lead_manager']::public.vendor_member_role[])))
  with check (public.is_admin() or exists (select 1 from public.listings where id = listing_id and public.has_vendor_role(vendor_id, array['owner', 'manager', 'lead_manager']::public.vendor_member_role[])));

create policy "admins read audit log" on public.audit_logs for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Business functions
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

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

  -- The daily cap and the per-vendor cooldown below are check-then-act, so
  -- concurrent submissions could all pass the same snapshot and insert. This
  -- transaction-scoped lock serialises a single customer's enquiries.
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
  if (select count(*) from public.leads where customer_id = current_user_id and created_at > now() - interval '24 hours') >= 5 then
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

revoke all on function public.submit_enquiry_and_reveal(uuid, date, text, integer) from public, anon;
grant execute on function public.submit_enquiry_and_reveal(uuid, date, text, integer) to authenticated;

-- Re-opening an already revealed contact is itself recorded, so the audit trail
-- covers repeat access and not only the first release.
create or replace function public.get_revealed_contact(requested_lead_id uuid)
returns table (lead_id uuid, phone text, email_address text, whatsapp text, revealed_at timestamptz, view_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.contact_reveals r
  set last_viewed_at = now(), view_count = r.view_count + 1
  where r.lead_id = requested_lead_id and r.customer_id = current_user_id;

  return query
  select r.lead_id, c.phone_e164, c.email, c.whatsapp_e164, r.revealed_at, r.view_count
  from public.contact_reveals r
  join public.vendor_contacts c on c.vendor_id = r.vendor_id
  where r.lead_id = requested_lead_id and r.customer_id = current_user_id;
end;
$$;

revoke all on function public.get_revealed_contact(uuid) from public, anon;
grant execute on function public.get_revealed_contact(uuid) to authenticated;

create or replace function public.start_vendor_application(
  requested_business_name text,
  requested_phone_e164 text,
  requested_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  created_vendor_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 733));

  if char_length(trim(requested_business_name)) not between 2 and 160 then
    raise exception 'Business name must contain 2 to 160 characters' using errcode = '22023';
  end if;
  if requested_phone_e164 !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Phone must use E.164 format' using errcode = '22023';
  end if;
  if requested_email is not null and requested_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Email is invalid' using errcode = '22023';
  end if;
  if (select count(*) from public.vendor_members where user_id = current_user_id and role = 'owner') >= 3 then
    raise exception 'Vendor application limit reached' using errcode = 'P0001';
  end if;

  insert into public.vendors (business_name, status)
  values (trim(requested_business_name), 'pending_review')
  returning id into created_vendor_id;

  insert into public.vendor_members (vendor_id, user_id, role)
  values (created_vendor_id, current_user_id, 'owner');

  insert into public.vendor_contacts (vendor_id, phone_e164, email)
  values (created_vendor_id, requested_phone_e164, nullif(lower(trim(requested_email)), ''));

  return created_vendor_id;
end;
$$;

revoke all on function public.start_vendor_application(text, text, text) from public, anon;
grant execute on function public.start_vendor_application(text, text, text) to authenticated;

-- Eligibility no longer depends solely on the vendor marking a lead `closed`,
-- which let a vendor suppress every review simply by never closing one.
create or replace function public.submit_review(
  requested_lead_id uuid,
  requested_rating smallint,
  requested_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  matched_listing_id uuid;
  created_review_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(requested_lead_id::text, 517));

  if requested_rating not between 1 and 5 then
    raise exception 'Rating must be between 1 and 5' using errcode = '22023';
  end if;
  if char_length(trim(requested_body)) not between 30 and 3000 then
    raise exception 'Review must contain 30 to 3000 characters' using errcode = '22023';
  end if;

  select listing_id into matched_listing_id
  from public.leads
  where id = requested_lead_id
    and customer_id = current_user_id
    and status <> 'spam'
    and (status = 'closed' or event_date + 14 <= public.india_today());

  if matched_listing_id is null then
    raise exception 'This enquiry is not eligible for review' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.reviews where lead_id = requested_lead_id) then
    raise exception 'This enquiry has already been reviewed' using errcode = 'P0001';
  end if;

  insert into public.reviews (lead_id, listing_id, customer_id, rating, body)
  values (requested_lead_id, matched_listing_id, current_user_id, requested_rating, trim(requested_body))
  returning id into created_review_id;

  return created_review_id;
end;
$$;

revoke all on function public.submit_review(uuid, smallint, text) from public, anon;
grant execute on function public.submit_review(uuid, smallint, text) to authenticated;

create or replace function public.log_admin_action(
  requested_action text,
  requested_entity_type text,
  requested_entity_id uuid,
  requested_detail jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, detail)
  values (auth.uid(), requested_action, requested_entity_type, requested_entity_id, requested_detail);
$$;

revoke all on function public.log_admin_action(text, text, uuid, jsonb) from public, anon, authenticated;

create or replace function public.admin_moderate_vendor(
  requested_vendor_id uuid,
  requested_action text,
  requested_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;

  if requested_action in ('approve', 'reinstate') then
    if not exists (select 1 from public.vendor_contacts where vendor_id = requested_vendor_id) then
      raise exception 'Vendor contact is required' using errcode = '22023';
    end if;
    update public.vendors
    set status = 'approved',
        verified_at = now(),
        verification_expires_at = now() + interval '12 months',
        moderated_by = auth.uid(),
        moderated_at = now(),
        moderation_note = requested_note
    where id = requested_vendor_id;

    -- Only listings taken down by the vendor-level cascade come back; a listing
    -- an admin suspended individually stays suspended.
    if requested_action = 'reinstate' then
      update public.listings
      set status = 'published',
          suspended_by_cascade = false,
          unpublished_at = null,
          moderated_by = auth.uid(),
          moderated_at = now()
      where vendor_id = requested_vendor_id and status = 'suspended' and suspended_by_cascade;
    end if;
  elsif requested_action = 'suspend' then
    update public.vendors
    set status = 'suspended',
        verified_at = null,
        verification_expires_at = null,
        moderated_by = auth.uid(),
        moderated_at = now(),
        moderation_note = requested_note
    where id = requested_vendor_id;

    update public.listings
    set status = 'suspended',
        suspended_by_cascade = true,
        unpublished_at = now(),
        moderated_by = auth.uid(),
        moderated_at = now()
    where vendor_id = requested_vendor_id and status = 'published';
  else
    raise exception 'Unsupported moderation action' using errcode = '22023';
  end if;

  perform public.log_admin_action('vendor.' || requested_action, 'vendor', requested_vendor_id, jsonb_build_object('note', requested_note));
end;
$$;

create or replace function public.admin_moderate_listing(
  requested_listing_id uuid,
  requested_action text,
  requested_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;

  if requested_action = 'publish' then
    if not exists (
      select 1 from public.listings l join public.vendors v on v.id = l.vendor_id
      where l.id = requested_listing_id and v.status = 'approved'
    ) then
      raise exception 'Vendor must be approved first' using errcode = '22023';
    end if;
    if not exists (select 1 from public.listing_media where listing_id = requested_listing_id) then
      raise exception 'At least one portfolio image is required' using errcode = '22023';
    end if;
    update public.listings
    set status = 'published',
        published_at = coalesce(published_at, now()),
        unpublished_at = null,
        suspended_by_cascade = false,
        moderated_by = auth.uid(),
        moderated_at = now(),
        moderation_note = requested_note
    where id = requested_listing_id;
  elsif requested_action in ('reject', 'suspend') then
    update public.listings
    set status = case
          when requested_action = 'reject' then 'rejected'::public.listing_status
          else 'suspended'::public.listing_status
        end,
        unpublished_at = now(),
        suspended_by_cascade = false,
        moderated_by = auth.uid(),
        moderated_at = now(),
        moderation_note = requested_note
    where id = requested_listing_id;
  else
    raise exception 'Unsupported moderation action' using errcode = '22023';
  end if;

  perform public.log_admin_action('listing.' || requested_action, 'listing', requested_listing_id, jsonb_build_object('note', requested_note));
end;
$$;

create or replace function public.admin_moderate_review(
  requested_review_id uuid,
  requested_action text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if requested_action not in ('publish', 'hide') then
    raise exception 'Unsupported moderation action' using errcode = '22023';
  end if;
  update public.reviews
  set is_published = (requested_action = 'publish'),
      moderated_by = auth.uid(),
      moderated_at = now()
  where id = requested_review_id;

  perform public.log_admin_action('review.' || requested_action, 'review', requested_review_id, '{}'::jsonb);
end;
$$;

-- Verification lapses after 12 months. Expiry is enforced at read time — the
-- "Verified" badge is derived from `verification_expires_at > now()`, so it
-- disappears on its own. This reports who needs re-verification without
-- unpublishing a working business's listings as a side effect.
create or replace function public.list_expired_verifications()
returns table (vendor_id uuid, business_name text, verification_expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.business_name, v.verification_expires_at
  from public.vendors v
  where public.is_admin()
    and v.status = 'approved'
    and v.verification_expires_at is not null
    and v.verification_expires_at <= now()
  order by v.verification_expires_at;
$$;

-- Rejection feedback belongs to the vendor, but `moderation_note` must not sit
-- on a table grant that `anon` or any signed-in stranger can read.
create or replace function public.get_listing_moderation_note(requested_listing_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select l.moderation_note
  from public.listings l
  where l.id = requested_listing_id
    and (public.is_vendor_member(l.vendor_id) or public.is_admin());
$$;

-- Provisional 24-month operational retention (docs/PRODUCT_DECISIONS.md).
-- Scrubs enquiry content and detaches the customer while keeping the reveal
-- audit trail and the vendor's aggregate history.
create or replace function public.anonymize_expired_records(retention interval default interval '24 months')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  if not public.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  update public.leads
  set message = '[removed on retention schedule]',
      guest_count = null,
      customer_id = null,
      anonymized_at = now()
  where anonymized_at is null and created_at < now() - retention;
  get diagnostics affected = row_count;

  update public.contact_reveals
  set customer_id = null
  where revealed_at < now() - retention;

  return affected;
end;
$$;

revoke all on function public.admin_moderate_vendor(uuid, text, text) from public, anon;
revoke all on function public.admin_moderate_listing(uuid, text, text) from public, anon;
revoke all on function public.admin_moderate_review(uuid, text) from public, anon;
revoke all on function public.list_expired_verifications() from public, anon;
revoke all on function public.get_listing_moderation_note(uuid) from public, anon;
revoke all on function public.anonymize_expired_records(interval) from public, anon;
grant execute on function public.admin_moderate_vendor(uuid, text, text) to authenticated;
grant execute on function public.admin_moderate_listing(uuid, text, text) to authenticated;
grant execute on function public.admin_moderate_review(uuid, text) to authenticated;
grant execute on function public.list_expired_verifications() to authenticated;
grant execute on function public.get_listing_moderation_note(uuid) to authenticated;
grant execute on function public.anonymize_expired_records(interval) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vendor-media', 'vendor-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Object paths are `<vendor_id>/<listing_id>/<uuid>.<ext>`. Keying on the
-- vendor rather than the uploader means the bucket is no longer an open upload
-- target for any signed-in user, and a vendor's own team can manage each
-- other's files.
-- Validates before casting rather than catching an exception: an exception
-- block opens a subtransaction on every call, and this runs inside a policy.
create or replace function public.storage_vendor_id(object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when (storage.foldername(object_name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then ((storage.foldername(object_name))[1])::uuid
    else null
  end;
$$;

revoke all on function public.storage_vendor_id(text) from public;
grant execute on function public.storage_vendor_id(text) to authenticated;

create policy "vendor members upload portfolio media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'vendor-media'
  and owner_id = auth.uid()::text
  and public.has_vendor_role(public.storage_vendor_id(name), array['owner', 'manager', 'editor']::public.vendor_member_role[])
  and storage.extension(name) in ('jpg', 'jpeg', 'png', 'webp')
);

create policy "vendor members delete portfolio media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'vendor-media'
  and (
    public.has_vendor_role(public.storage_vendor_id(name), array['owner', 'manager', 'editor']::public.vendor_member_role[])
    or public.is_admin()
  )
);

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

insert into public.cities (name, slug, state_name, sort_order) values
  ('Delhi NCR', 'delhi-ncr', 'Delhi NCR', 10),
  ('Mumbai', 'mumbai', 'Maharashtra', 20),
  ('Bengaluru', 'bengaluru', 'Karnataka', 30),
  ('Hyderabad', 'hyderabad', 'Telangana', 40),
  ('Chennai', 'chennai', 'Tamil Nadu', 50),
  ('Kolkata', 'kolkata', 'West Bengal', 60),
  ('Pune', 'pune', 'Maharashtra', 70),
  ('Ahmedabad', 'ahmedabad', 'Gujarat', 80),
  ('Jaipur', 'jaipur', 'Rajasthan', 90),
  ('Surat', 'surat', 'Gujarat', 100),
  ('Kochi', 'kochi', 'Kerala', 110),
  ('Chandigarh', 'chandigarh', 'Chandigarh', 120);

insert into public.categories (name, slug, sort_order) values
  ('Venues', 'venues', 10),
  ('Photographers', 'photographers', 20),
  ('Makeup Artists', 'makeup-artists', 30),
  ('Planners & Decorators', 'planners-decorators', 40),
  ('Caterers', 'caterers', 50);
