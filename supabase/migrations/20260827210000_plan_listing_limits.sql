-- ---------------------------------------------------------------------------
-- Make the plan tiers mean something
--
-- `subscription_plans.features` was a text array — marketing copy with nothing
-- behind it. No column expressed a limit and no code read a plan to decide what
-- a vendor could do, so the Free tier's "public profile in one city and
-- category" was unenforced and a Free vendor could publish unlimited listings.
-- Nothing separated the tiers, which means nothing would ever have been sold.
--
-- Free is now one listing per business. Enforced here rather than in the form,
-- so it holds for any client and cannot be bypassed by posting directly.
-- ---------------------------------------------------------------------------

alter table public.subscription_plans
  add column if not exists max_listings integer
    check (max_listings is null or max_listings > 0);

comment on column public.subscription_plans.max_listings is
  'Listings a vendor on this plan may own. NULL means unlimited.';

update public.subscription_plans set max_listings = 1 where code = 'free';
update public.subscription_plans set max_listings = 5
  where code in ('pro-monthly', 'pro-annual');

-- Copy that promises a limit the database does not keep is worse than no copy.
update public.subscription_plans
set features = to_jsonb(array[
  'Public profile in one city and category',
  'One published listing',
  'Portfolio uploads',
  'Lead inbox',
  'Reply to reviews'
])
where code = 'free';

-- Packages, analytics and priority moderation are not built. Advertising them
-- on a page with a payment button is a refund request waiting to happen; they
-- go back on the list when they exist.
update public.subscription_plans
set features = to_jsonb(array[
  'Everything in Free',
  'Up to five listings',
  'Listings in more than one city',
  'Team access'
])
where code = 'pro-monthly';

update public.subscription_plans
set features = to_jsonb(array[
  'Everything in Pro',
  'Two months free',
  'Annual invoice for GST'
])
where code = 'pro-annual';

-- ---------------------------------------------------------------------------
-- The limit a vendor is actually subject to
--
-- Definer rights because `vendor_subscriptions` and `subscription_plans` are
-- not readable by an ordinary member, and the check has to work for the vendor
-- creating the listing.
-- ---------------------------------------------------------------------------

create or replace function public.vendor_listing_allowance(requested_vendor_id uuid)
returns table (used integer, allowed integer, plan_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::integer
     from public.listings l
     where l.vendor_id = requested_vendor_id
       and l.status <> 'archived'),
    coalesce(active_plan.max_listings, free_plan.max_listings),
    coalesce(active_plan.name, free_plan.name)
  from (select max_listings, name from public.subscription_plans where code = 'free') free_plan
  left join lateral (
    select p.max_listings, p.name
    from public.vendor_subscriptions s
    join public.subscription_plans p on p.id = s.plan_id
    where s.vendor_id = requested_vendor_id
      and s.status = 'active'
      and (s.current_period_end is null or s.current_period_end > now())
    order by p.max_listings desc nulls first
    limit 1
  ) active_plan on true
  where public.is_vendor_member(requested_vendor_id) or public.is_admin();
$$;

revoke all on function public.vendor_listing_allowance(uuid) from public, anon;
grant execute on function public.vendor_listing_allowance(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Enforcement
--
-- A trigger rather than a policy: a policy can only say yes or no, and this
-- needs to explain *why* so the vendor sees a reason rather than a silent
-- rejection.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_listing_allowance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowance record;
begin
  -- Admins are not subject to a plan; moderation must never be blocked by one.
  if public.is_admin() then return new; end if;

  select * into allowance
  from public.vendor_listing_allowance(new.vendor_id);

  if allowance.allowed is null then return new; end if;

  if allowance.used >= allowance.allowed then
    raise exception
      'Your % plan includes % listing(s). Upgrade to add more.',
      allowance.plan_name, allowance.allowed
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists listings_enforce_allowance on public.listings;
create trigger listings_enforce_allowance
  before insert on public.listings
  for each row execute function public.enforce_listing_allowance();
