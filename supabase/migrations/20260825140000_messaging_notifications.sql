-- Threaded messaging on a lead, in-app notifications, and a derived
-- response-time metric.
--
-- Deliberately not a chat room: messages hang off the existing `leads` record,
-- are read on navigation rather than pushed, and every one also produces an
-- email. Indian wedding vendors work from WhatsApp, so the platform thread is
-- the record and the safety net, not an attempt to trap the conversation.

create type public.message_author as enum ('customer', 'vendor', 'system');

create type public.notification_kind as enum (
  'lead_created',
  'message_received',
  'listing_published',
  'listing_rejected',
  'listing_suspended',
  'vendor_approved',
  'review_published',
  'payment_captured'
);

create table public.lead_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  -- Nullable so an account can be erased without destroying the other
  -- party's conversation history.
  author_id uuid references auth.users (id) on delete set null,
  -- Set by `send_lead_message` from the caller's actual relationship to the
  -- lead. Never accepted from the client.
  author_type public.message_author not null,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  read_by_customer_at timestamptz,
  read_by_vendor_at timestamptz,
  created_at timestamptz not null default now()
);

create index lead_messages_thread_idx on public.lead_messages (lead_id, created_at);
create index lead_messages_unread_customer_idx
  on public.lead_messages (lead_id)
  where read_by_customer_at is null;
create index lead_messages_unread_vendor_idx
  on public.lead_messages (lead_id)
  where read_by_vendor_at is null;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.notification_kind not null,
  title text not null check (char_length(title) between 1 and 200),
  body text check (body is null or char_length(body) <= 500),
  -- Always an internal path. Validated by the application before rendering.
  url text check (url is null or url ~ '^/[^/].*$' or url = '/'),
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx
  on public.notifications (user_id)
  where read_at is null;

-- First vendor reply, used to derive a real response-time figure. The public
-- profile has always had a "Response" slot; until now it rendered nothing.
alter table public.leads
  add column first_vendor_response_at timestamptz;

alter table public.listings
  add column response_minutes integer check (response_minutes is null or response_minutes >= 0),
  add column response_sample_size integer not null default 0 check (response_sample_size >= 0);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.lead_messages enable row level security;
alter table public.notifications enable row level security;

-- `author_id` is granted because the UI must distinguish "mine" from "theirs".
-- It is the counterparty's opaque auth id, which each side can already infer
-- from `author_type`, so it discloses nothing new.
grant select (id, lead_id, author_id, author_type, body, read_by_customer_at, read_by_vendor_at, created_at)
  on public.lead_messages to authenticated;
grant select, update (read_at) on public.notifications to authenticated;

-- Inserts go through `send_lead_message` only, so the client cannot forge an
-- author or write into a thread it is not part of.
create policy "participants read thread" on public.lead_messages for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.id = lead_id
        and (
          l.customer_id = auth.uid()
          or exists (
            select 1 from public.listings li
            where li.id = l.listing_id and public.is_vendor_member(li.vendor_id)
          )
        )
    )
  );

create policy "own notifications read" on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy "own notifications update" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

/**
 * Which side of a lead the caller is on, or null if neither.
 */
create or replace function public.lead_participant_role(check_lead_id uuid)
returns public.message_author
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.leads l
      where l.id = check_lead_id and l.customer_id = auth.uid()
    ) then 'customer'::public.message_author
    when exists (
      select 1 from public.leads l
      join public.listings li on li.id = l.listing_id
      where l.id = check_lead_id and public.is_vendor_member(li.vendor_id)
    ) then 'vendor'::public.message_author
    else null
  end;
$$;

revoke all on function public.lead_participant_role(uuid) from public, anon;
grant execute on function public.lead_participant_role(uuid) to authenticated;

create or replace function public.create_notification(
  target_user_id uuid,
  requested_kind public.notification_kind,
  requested_title text,
  requested_body text default null,
  requested_url text default null,
  requested_entity_type text default null,
  requested_entity_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_id uuid;
begin
  if target_user_id is null then return null; end if;

  insert into public.notifications (
    user_id, kind, title, body, url, entity_type, entity_id
  )
  values (
    target_user_id, requested_kind, left(requested_title, 200),
    left(requested_body, 500), requested_url, requested_entity_type, requested_entity_id
  )
  returning id into created_id;

  return created_id;
end;
$$;

revoke all on function public.create_notification(uuid, public.notification_kind, text, text, text, text, uuid)
  from public, anon, authenticated;

/**
 * Post a message to a lead thread.
 *
 * The author type is derived from the caller's actual relationship to the lead
 * rather than accepted as a parameter, so neither side can impersonate the
 * other. Notifying the counterparty happens in the same transaction as the
 * insert, so a message can never exist without its notification.
 */
create or replace function public.send_lead_message(
  requested_lead_id uuid,
  requested_body text
)
returns table (message_id uuid, sender_type public.message_author, recipient_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  participant_role public.message_author;
  lead_row record;
  created_id uuid;
  target_id uuid;
  notice_title text;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if char_length(btrim(requested_body)) not between 1 and 4000 then
    raise exception 'Message must contain 1 to 4000 characters' using errcode = '22023';
  end if;

  participant_role := public.lead_participant_role(requested_lead_id);
  if participant_role is null then
    raise exception 'You are not part of this conversation' using errcode = '42501';
  end if;

  -- Serialises a single thread so two rapid submits cannot both be treated as
  -- the first vendor reply.
  perform pg_advisory_xact_lock(hashtextextended(requested_lead_id::text, 613));

  select l.*, li.vendor_id, li.title as listing_title, li.slug as listing_slug
  into lead_row
  from public.leads l
  join public.listings li on li.id = l.listing_id
  where l.id = requested_lead_id;

  if lead_row.id is null then
    raise exception 'That enquiry no longer exists' using errcode = 'P0002';
  end if;
  if lead_row.status = 'spam' then
    raise exception 'This conversation is closed' using errcode = 'P0001';
  end if;

  insert into public.lead_messages (lead_id, author_id, author_type, body,
    read_by_customer_at, read_by_vendor_at)
  values (
    requested_lead_id, current_user_id, participant_role, btrim(requested_body),
    case when participant_role = 'customer' then now() else null end,
    case when participant_role = 'vendor' then now() else null end
  )
  returning id into created_id;

  if participant_role = 'vendor' then
    -- First reply stamps the lead and refreshes the listing's response metric.
    if lead_row.first_vendor_response_at is null then
      update public.leads
      set first_vendor_response_at = now()
      where id = requested_lead_id;

      update public.listings li
      set response_minutes = agg.minutes,
          response_sample_size = agg.total
      from (
        select
          round(avg(extract(epoch from (l.first_vendor_response_at - l.created_at)) / 60))::integer as minutes,
          count(*)::integer as total
        from public.leads l
        where l.listing_id = lead_row.listing_id
          and l.first_vendor_response_at is not null
      ) agg
      where li.id = lead_row.listing_id;
    end if;

    -- A vendor reply moves a new lead along without the vendor having to
    -- remember to change the status.
    if lead_row.status = 'new' then
      update public.leads set status = 'contacted' where id = requested_lead_id;
    end if;

    target_id := lead_row.customer_id;
    notice_title := lead_row.listing_title || ' replied to your enquiry';
  else
    select vm.user_id into target_id
    from public.vendor_members vm
    where vm.vendor_id = lead_row.vendor_id and vm.role = 'owner'
    order by vm.created_at
    limit 1;
    notice_title := 'New message about ' || lead_row.listing_title;
  end if;

  perform public.create_notification(
    target_id,
    'message_received'::public.notification_kind,
    notice_title,
    left(btrim(requested_body), 160),
    case when participant_role = 'vendor'
      then '/account/enquiries/' || requested_lead_id::text
      else '/vendor/dashboard/leads/' || requested_lead_id::text
    end,
    'lead',
    requested_lead_id
  );

  return query select created_id, participant_role, target_id;
end;
$$;

revoke all on function public.send_lead_message(uuid, text) from public, anon;
grant execute on function public.send_lead_message(uuid, text) to authenticated;

/** Mark every message in a thread read for whichever side the caller is on. */
create or replace function public.mark_thread_read(requested_lead_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  participant_role public.message_author;
  affected integer;
begin
  participant_role := public.lead_participant_role(requested_lead_id);
  if participant_role is null then return 0; end if;

  if participant_role = 'customer' then
    update public.lead_messages
    set read_by_customer_at = now()
    where lead_id = requested_lead_id and read_by_customer_at is null;
  else
    update public.lead_messages
    set read_by_vendor_at = now()
    where lead_id = requested_lead_id and read_by_vendor_at is null;
  end if;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.mark_thread_read(uuid) from public, anon;
grant execute on function public.mark_thread_read(uuid) to authenticated;

/**
 * The counterparty's notification address, for the new-message email.
 *
 * Security definer because a customer address lives in `auth.users` and a
 * vendor address in `vendor_contacts`, neither of which a client role may read.
 * It returns only the address, and only to a genuine participant.
 */
create or replace function public.get_message_notification_target(
  requested_message_id uuid
)
returns table (
  recipient_email text,
  recipient_id uuid,
  recipient_type public.message_author,
  listing_title text,
  listing_slug text,
  preview text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  msg record;
begin
  select m.*, l.customer_id, l.listing_id, li.vendor_id,
         li.title as listing_title, li.slug as listing_slug
  into msg
  from public.lead_messages m
  join public.leads l on l.id = m.lead_id
  join public.listings li on li.id = l.listing_id
  where m.id = requested_message_id;

  if msg.id is null then return; end if;
  -- Only a participant in this thread may trigger its notification.
  if public.lead_participant_role(msg.lead_id) is null then return; end if;

  if msg.author_type = 'vendor' then
    return query
    select u.email::text, msg.customer_id, 'customer'::public.message_author,
           msg.listing_title, msg.listing_slug, left(msg.body, 160)
    from auth.users u
    where u.id = msg.customer_id
      and coalesce(
        (select np.lead_emails from public.notification_preferences np where np.user_id = msg.customer_id),
        true
      );
  else
    return query
    select c.email, vm.user_id, 'vendor'::public.message_author,
           msg.listing_title, msg.listing_slug, left(msg.body, 160)
    from public.vendor_contacts c
    join lateral (
      select v.user_id from public.vendor_members v
      where v.vendor_id = msg.vendor_id and v.role = 'owner'
      order by v.created_at limit 1
    ) vm on true
    where c.vendor_id = msg.vendor_id
      and c.email is not null
      and coalesce(
        (select np.lead_emails from public.notification_preferences np where np.user_id = vm.user_id),
        true
      );
  end if;
end;
$$;

revoke all on function public.get_message_notification_target(uuid) from public, anon;
grant execute on function public.get_message_notification_target(uuid) to authenticated;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  if auth.uid() is null then return 0; end if;
  update public.notifications
  set read_at = now()
  where user_id = auth.uid() and read_at is null;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- ---------------------------------------------------------------------------
-- Notify on the events that already existed
-- ---------------------------------------------------------------------------

-- A new lead now also raises an in-app notification for the vendor owner.
create or replace function public.notify_vendor_of_new_lead()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  listing_title text;
begin
  select vm.user_id, li.title into owner_id, listing_title
  from public.listings li
  join public.vendor_members vm on vm.vendor_id = li.vendor_id and vm.role = 'owner'
  where li.id = new.listing_id
  order by vm.created_at
  limit 1;

  perform public.create_notification(
    owner_id,
    'lead_created'::public.notification_kind,
    'New enquiry for ' || coalesce(listing_title, 'your listing'),
    'Event on ' || to_char(new.event_date, 'DD Mon YYYY'),
    '/vendor/dashboard/leads/' || new.id::text,
    'lead',
    new.id
  );
  return null;
end;
$$;

create trigger leads_notify_vendor
after insert on public.leads
for each row execute function public.notify_vendor_of_new_lead();

-- Moderation decisions reach every member of the business, not just the owner.
create or replace function public.notify_members_of_listing_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  member record;
  kind public.notification_kind;
  title text;
begin
  if new.status is not distinct from old.status then return null; end if;

  if new.status = 'published' then
    kind := 'listing_published'; title := new.title || ' is now live';
  elsif new.status = 'rejected' then
    kind := 'listing_rejected'; title := new.title || ' was returned for changes';
  elsif new.status = 'suspended' then
    kind := 'listing_suspended'; title := new.title || ' has been suspended';
  else
    return null;
  end if;

  for member in
    select user_id from public.vendor_members where vendor_id = new.vendor_id
  loop
    perform public.create_notification(
      member.user_id, kind, title, new.moderation_note,
      '/vendor/dashboard', 'listing', new.id
    );
  end loop;
  return null;
end;
$$;

create trigger listings_notify_members
after update of status on public.listings
for each row execute function public.notify_members_of_listing_decision();
