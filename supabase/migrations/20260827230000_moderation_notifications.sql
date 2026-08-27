-- ---------------------------------------------------------------------------
-- Tell the vendor what moderation decided about their BUSINESS
--
-- Listing decisions have always notified: `listings_notify_members` is an
-- AFTER UPDATE trigger that writes to every member of the business. Vendor
-- decisions have nothing. Approving a business changes a status column and
-- that is all -- no bell, and no email either, because the only other channel
-- is `notifyVendorOfApproval` through Resend, which is unconfigured and
-- returns without sending.
--
-- So the single most important moment in the vendor journey, the one the whole
-- two-stage flow is built around, is the one moment the product says nothing.
-- The vendor returns to a dashboard that looks exactly as it did while they
-- were waiting, which is why the flow reads as a black hole.
--
-- A trigger rather than a line in `admin_moderate_vendor`, to match how
-- listings already work: the notification and the status change land in one
-- transaction, and a decision made from SQL or a future admin tool still
-- notifies.
-- ---------------------------------------------------------------------------

-- A suspended business is not a suspended listing and should not borrow its
-- label, so suspension gets the one kind the enum was missing.
alter type public.notification_kind add value if not exists 'vendor_suspended';

-- ---------------------------------------------------------------------------
-- One place that fans a notification out to a business's members
--
-- `notify_members_of_listing_decision` and `notify_vendor_of_new_lead` each
-- carry their own copy of this loop. A third copy for vendor decisions is the
-- point at which it should become a function.
-- ---------------------------------------------------------------------------

create or replace function public.notify_vendor_members(
  requested_vendor_id uuid,
  requested_kind public.notification_kind,
  requested_title text,
  requested_body text default null,
  requested_url text default null,
  requested_entity_type text default null,
  requested_entity_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  member record;
  sent integer := 0;
begin
  -- Every member, not just the owner. `vendor_members` exists precisely so a
  -- manager can run the account; telling only the owner that a listing was
  -- rejected hides it from the person who would fix it.
  for member in
    select user_id from public.vendor_members where vendor_id = requested_vendor_id
  loop
    perform public.create_notification(
      member.user_id, requested_kind, requested_title, requested_body,
      requested_url, requested_entity_type, requested_entity_id
    );
    sent := sent + 1;
  end loop;

  return sent;
end;
$$;

revoke all on function public.notify_vendor_members(uuid, public.notification_kind, text, text, text, text, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The missing one: business decisions
-- ---------------------------------------------------------------------------

create or replace function public.notify_members_of_vendor_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  decision public.notification_kind;
  headline text;
  detail text;
  destination text;
begin
  if new.status is not distinct from old.status then return null; end if;

  if new.status = 'approved' then
    decision := 'vendor_approved';
    headline := new.business_name || ' has been approved';
    -- Says what changed AND what to do next. "Approved" alone leaves the
    -- vendor exactly where they were: on a page with no obvious next step.
    detail := 'You can add listings now. The identity check is done, so each listing is reviewed only on its own content.';
    destination := '/vendor/dashboard/listings';
  elsif new.status = 'suspended' then
    decision := 'vendor_suspended';
    headline := new.business_name || ' has been suspended';
    -- The moderator note is the only part that makes this actionable, so it
    -- leads. The fallback exists because the note is optional.
    detail := coalesce(new.moderation_note, 'Published listings have been taken down. Contact support to resolve this.');
    destination := '/vendor/dashboard';
  else
    return null;
  end if;

  perform public.notify_vendor_members(
    new.id, decision, headline, detail, destination, 'vendor', new.id
  );
  return null;
end;
$$;

drop trigger if exists vendors_notify_members on public.vendors;
create trigger vendors_notify_members
  after update of status on public.vendors
  for each row execute function public.notify_members_of_vendor_decision();

-- ---------------------------------------------------------------------------
-- Listing decisions: same behaviour, one copy of the loop, better destination
--
-- The URL was `/vendor/dashboard`, which is the workspace overview. The
-- listings page is where the vendor can actually act on the decision.
-- ---------------------------------------------------------------------------

create or replace function public.notify_members_of_listing_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  decision public.notification_kind;
  headline text;
begin
  if new.status is not distinct from old.status then return null; end if;

  if new.status = 'published' then
    decision := 'listing_published'; headline := new.title || ' is now live';
  elsif new.status = 'rejected' then
    decision := 'listing_rejected'; headline := new.title || ' was returned for changes';
  elsif new.status = 'suspended' then
    decision := 'listing_suspended'; headline := new.title || ' has been suspended';
  else
    return null;
  end if;

  perform public.notify_vendor_members(
    new.vendor_id, decision, headline, new.moderation_note,
    '/vendor/dashboard/listings', 'listing', new.id
  );
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Restore the two moderation functions
--
-- An earlier revision of this migration wrote the notifications from inside
-- these functions, before the listing trigger above was found -- which
-- produced two notifications per listing decision. The trigger is the right
-- home for both, so these go back to exactly what the initial migration
-- defined and hold no notification logic at all.
-- ---------------------------------------------------------------------------

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
