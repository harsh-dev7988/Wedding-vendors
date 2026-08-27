-- ---------------------------------------------------------------------------
-- Columns the app reads that no client role could read
--
-- These tables use column-level grants, which is how coordinates, moderation
-- notes and payment identifiers stay away from clients. The cost is that
-- `alter table ... add column` grants nothing, and neither does a column that
-- was simply left off the original list. PostgREST then answers any query
-- naming that column with "permission denied for table" -- the whole request,
-- not just the column.
--
-- supabase-js reports that as `{ data: null }`, and a page that treats null as
-- "not found" renders a 404 for a row that plainly exists. That is what
-- happened to a vendor opening a lead: the list worked because it does not
-- select `first_vendor_response_at`, and the detail page 404'd because it does.
--
-- Three more pages were failing the same way and had not been noticed:
-- the admin listing page, the admin vendor page, and the vendor's own business
-- settings, which reported "you do not manage a business yet" to an owner.
--
-- `npm run db:grants` now checks every `.select()` in the app against these
-- grants, so the next one fails in a script rather than in front of a user.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. leads.first_vendor_response_at -- a plain grant is correct here
--
-- Row access is already scoped by RLS to the customer, the vendor's members and
-- admins, so nobody gains a row they could not already read. The column is when
-- the vendor first replied, which is what the public response-time figure is
-- derived from anyway.
-- ---------------------------------------------------------------------------

grant select (first_vendor_response_at) on public.leads to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Moderation fields and legal name -- a grant would be wrong
--
-- `vendors` is readable by anyone for any approved business, and `listings` for
-- any published one. Granting `legal_name` or `moderation_note` would therefore
-- publish them to the world: a moderator's private note about a business would
-- be one query away for anyone at all.
--
-- Definer functions instead, filtered to members and admins. A vendor seeing
-- the note explaining their own suspension is the point -- that is already how
-- `get_listing_moderation_note` works, which has existed since the first
-- migration and which nothing ever called.
-- ---------------------------------------------------------------------------

create or replace function public.get_vendor_private_details(
  requested_vendor_ids uuid[]
)
returns table (
  id uuid,
  legal_name text,
  moderated_at timestamptz,
  moderation_note text
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.legal_name, v.moderated_at, v.moderation_note
  from public.vendors v
  where v.id = any(requested_vendor_ids)
    and (public.is_vendor_member(v.id) or public.is_admin());
$$;

revoke all on function public.get_vendor_private_details(uuid[]) from public, anon;
grant execute on function public.get_vendor_private_details(uuid[]) to authenticated;

create or replace function public.get_listing_private_details(
  requested_listing_ids uuid[]
)
returns table (
  id uuid,
  moderated_at timestamptz,
  moderation_note text
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.moderated_at, l.moderation_note
  from public.listings l
  where l.id = any(requested_listing_ids)
    and (public.is_vendor_member(l.vendor_id) or public.is_admin());
$$;

revoke all on function public.get_listing_private_details(uuid[]) from public, anon;
grant execute on function public.get_listing_private_details(uuid[]) to authenticated;
