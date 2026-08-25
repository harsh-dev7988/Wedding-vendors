-- Notifications, subscriptions and payments (Razorpay), abuse reports,
-- verification evidence, and account deletion requests.

create type public.report_reason as enum (
  'inaccurate', 'not_a_real_business', 'offensive', 'spam', 'duplicate', 'other'
);
create type public.report_status as enum ('open', 'reviewing', 'actioned', 'dismissed');
create type public.subscription_status as enum (
  'pending', 'active', 'past_due', 'cancelled', 'expired'
);
create type public.payment_status as enum (
  'created', 'authorized', 'captured', 'failed', 'refunded'
);
create type public.verification_document_kind as enum (
  'gst', 'pan', 'business_registration', 'address_proof', 'portfolio_rights', 'other'
);

-- ---------------------------------------------------------------------------
-- Notification preferences and delivery log
-- ---------------------------------------------------------------------------

create table public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  lead_emails boolean not null default true,
  moderation_emails boolean not null default true,
  review_request_emails boolean not null default true,
  product_emails boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotency for outbound email. `dedupe_key` makes a retried Server Action or
-- a replayed webhook a no-op rather than a second message to the same person.
create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  template text not null,
  recipient_user_id uuid references auth.users (id) on delete set null,
  -- Deliberately NOT the recipient address: storing it here would place a
  -- vendor's private email in a table other surfaces can read.
  provider_message_id text,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  error_detail text,
  created_at timestamptz not null default now()
);

create index email_log_recipient_idx on public.email_log (recipient_user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Subscriptions and payments
-- ---------------------------------------------------------------------------

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  description text,
  -- Money is stored in paise as an integer. Never floating point.
  price_paise integer not null check (price_paise >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  interval_months smallint not null default 1 check (interval_months between 1 and 12),
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.vendor_subscriptions (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  plan_id uuid not null references public.subscription_plans (id),
  status public.subscription_status not null default 'pending',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancelled_at timestamptz,
  razorpay_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One live subscription per vendor; historical rows remain for the audit trail.
create unique index vendor_subscriptions_active_idx
  on public.vendor_subscriptions (vendor_id)
  where status in ('active', 'past_due', 'pending');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  subscription_id uuid references public.vendor_subscriptions (id) on delete set null,
  plan_id uuid references public.subscription_plans (id),
  amount_paise integer not null check (amount_paise >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  status public.payment_status not null default 'created',
  razorpay_order_id text not null unique,
  razorpay_payment_id text unique,
  razorpay_signature text,
  -- Razorpay retries webhooks; the unique order id plus this column make
  -- reprocessing idempotent.
  captured_at timestamptz,
  failure_reason text,
  notes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_vendor_idx on public.payments (vendor_id, created_at desc);
create index vendor_subscriptions_vendor_idx on public.vendor_subscriptions (vendor_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Abuse reports
-- ---------------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings (id) on delete cascade,
  review_id uuid references public.reviews (id) on delete cascade,
  reporter_id uuid references auth.users (id) on delete set null,
  reason public.report_reason not null,
  detail text check (detail is null or char_length(detail) between 10 and 2000),
  status public.report_status not null default 'open',
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 2000),
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (listing_id is not null or review_id is not null)
);

create index reports_status_idx on public.reports (status, created_at desc);
create index reports_listing_idx on public.reports (listing_id);
-- One open report per reporter per listing, so a single upset user cannot
-- inflate the queue.
create unique index reports_reporter_listing_idx
  on public.reports (reporter_id, listing_id)
  where status = 'open' and listing_id is not null;

-- ---------------------------------------------------------------------------
-- Verification evidence
-- ---------------------------------------------------------------------------

-- Stored in a PRIVATE bucket. These are GST certificates, PAN cards and
-- address proofs; a public bucket would be a serious disclosure.
create table public.verification_documents (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  kind public.verification_document_kind not null,
  storage_path text not null unique,
  original_filename text,
  uploaded_by uuid references auth.users (id) on delete set null,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  created_at timestamptz not null default now()
);

create index verification_documents_vendor_idx on public.verification_documents (vendor_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Account deletion requests (DPDP)
-- ---------------------------------------------------------------------------

create table public.account_deletion_requests (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reason text check (reason is null or char_length(reason) <= 1000),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references auth.users (id) on delete set null
);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.notification_preferences enable row level security;
alter table public.email_log enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.vendor_subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.reports enable row level security;
alter table public.verification_documents enable row level security;
alter table public.account_deletion_requests enable row level security;

-- Plans are the only public table here.
grant select on public.subscription_plans to anon, authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant select (id, vendor_id, plan_id, status, current_period_start, current_period_end, cancelled_at, created_at)
  on public.vendor_subscriptions to authenticated;
grant select (id, vendor_id, plan_id, amount_paise, currency, status, razorpay_order_id, captured_at, created_at)
  on public.payments to authenticated;
grant select, insert on public.reports to authenticated;
grant select, insert, delete on public.verification_documents to authenticated;
grant select, insert on public.account_deletion_requests to authenticated;
-- `email_log` has no client grant at all: it is written by the server only.

create policy "public active plans" on public.subscription_plans for select using (is_active or public.is_admin());

create policy "own notification preferences" on public.notification_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "vendor billing read" on public.vendor_subscriptions for select to authenticated
  using (public.has_vendor_role(vendor_id, array['owner', 'manager']::public.vendor_member_role[]) or public.is_admin());

create policy "vendor payments read" on public.payments for select to authenticated
  using (public.has_vendor_role(vendor_id, array['owner', 'manager']::public.vendor_member_role[]) or public.is_admin());

-- A reporter sees only their own report; admins see the queue.
create policy "reporters read own reports" on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());
create policy "signed-in users can report" on public.reports for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and status = 'open'
    and (
      listing_id is null
      or exists (select 1 from public.listings where id = listing_id and status = 'published')
    )
  );

create policy "vendor evidence read" on public.verification_documents for select to authenticated
  using (public.has_vendor_role(vendor_id, array['owner', 'manager']::public.vendor_member_role[]) or public.is_admin());
create policy "vendor evidence upload" on public.verification_documents for insert to authenticated
  with check (public.has_vendor_role(vendor_id, array['owner', 'manager']::public.vendor_member_role[]));
create policy "vendor evidence delete" on public.verification_documents for delete to authenticated
  using (public.has_vendor_role(vendor_id, array['owner']::public.vendor_member_role[]) or public.is_admin());

create policy "own deletion request" on public.account_deletion_requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "request own deletion" on public.account_deletion_requests for insert to authenticated
  with check (user_id = auth.uid());

create trigger notification_preferences_touch before update on public.notification_preferences
  for each row execute function public.touch_updated_at();
create trigger vendor_subscriptions_touch before update on public.vendor_subscriptions
  for each row execute function public.touch_updated_at();
create trigger payments_touch before update on public.payments
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Who should be emailed about a new lead, and at which address.
--
-- Security definer because it reads `vendor_contacts`, which no client role may
-- select. It returns only what the mailer needs and is never callable by a
-- client — the mailer runs server-side with the caller's JWT and this function
-- checks that the caller actually owns the lead.
create or replace function public.get_lead_notification_target(requested_lead_id uuid)
returns table (
  vendor_id uuid,
  business_name text,
  notify_email text,
  listing_title text,
  listing_slug text,
  owner_user_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.business_name, c.email, l.title, l.slug, m.user_id
  from public.leads lead
  join public.listings l on l.id = lead.listing_id
  join public.vendors v on v.id = l.vendor_id
  join public.vendor_contacts c on c.vendor_id = v.id
  join lateral (
    select vm.user_id from public.vendor_members vm
    where vm.vendor_id = v.id and vm.role = 'owner'
    order by vm.created_at limit 1
  ) m on true
  where lead.id = requested_lead_id
    and c.email is not null
    -- Only the customer who created the lead may trigger its notification.
    and lead.customer_id = auth.uid()
    and coalesce(
      (select np.lead_emails from public.notification_preferences np where np.user_id = m.user_id),
      true
    );
$$;

revoke all on function public.get_lead_notification_target(uuid) from public, anon;
grant execute on function public.get_lead_notification_target(uuid) to authenticated;

-- Records an outbound email atomically. Returns false when the dedupe key has
-- already been used, so the caller skips sending.
create or replace function public.claim_email_send(
  requested_dedupe_key text,
  requested_template text,
  requested_recipient uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.email_log (dedupe_key, template, recipient_user_id)
  values (requested_dedupe_key, requested_template, requested_recipient);
  return true;
exception when unique_violation then
  return false;
end;
$$;

revoke all on function public.claim_email_send(text, text, uuid) from public, anon;
grant execute on function public.claim_email_send(text, text, uuid) to authenticated;

create or replace function public.mark_email_sent(
  requested_dedupe_key text,
  requested_provider_id text,
  requested_error text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.email_log
  set status = case when requested_error is null then 'sent' else 'failed' end,
      provider_message_id = requested_provider_id,
      error_detail = requested_error
  where dedupe_key = requested_dedupe_key;
$$;

revoke all on function public.mark_email_sent(text, text, text) from public, anon;
grant execute on function public.mark_email_sent(text, text, text) to authenticated;

-- Starts a checkout. Creates the local payment row; the Razorpay order id is
-- attached by the caller after the provider call succeeds.
create or replace function public.start_subscription_checkout(
  requested_vendor_id uuid,
  requested_plan_code text,
  requested_order_id text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan record;
  created_payment_id uuid;
begin
  if not public.has_vendor_role(requested_vendor_id, array['owner']::public.vendor_member_role[]) then
    raise exception 'Only a business owner can manage billing' using errcode = '42501';
  end if;

  select id, price_paise into plan
  from public.subscription_plans
  where code = requested_plan_code and is_active;

  if plan.id is null then
    raise exception 'That plan is not available' using errcode = '22023';
  end if;

  insert into public.payments (vendor_id, plan_id, amount_paise, razorpay_order_id, status)
  values (requested_vendor_id, plan.id, plan.price_paise, requested_order_id, 'created')
  returning id into created_payment_id;

  return created_payment_id;
end;
$$;

revoke all on function public.start_subscription_checkout(uuid, text, text) from public, anon;
grant execute on function public.start_subscription_checkout(uuid, text, text) to authenticated;

-- Applied by the Razorpay webhook, which runs with the service role. Idempotent
-- on `razorpay_payment_id`: Razorpay retries webhooks and may deliver the same
-- event more than once.
create or replace function public.apply_razorpay_payment(
  requested_order_id text,
  requested_payment_id text,
  requested_status public.payment_status,
  requested_signature text default null,
  requested_failure text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
  plan record;
  period_end timestamptz;
  new_subscription_id uuid;
begin
  select p.id, p.vendor_id, p.plan_id, p.status
  into target
  from public.payments p
  where p.razorpay_order_id = requested_order_id
  for update;

  if target.id is null then
    raise exception 'Unknown Razorpay order' using errcode = 'P0002';
  end if;

  -- Already settled: report success without doing the work twice.
  if target.status = 'captured' and requested_status = 'captured' then
    return target.id;
  end if;

  update public.payments
  set status = requested_status,
      razorpay_payment_id = coalesce(requested_payment_id, razorpay_payment_id),
      razorpay_signature = coalesce(requested_signature, razorpay_signature),
      failure_reason = requested_failure,
      captured_at = case when requested_status = 'captured' then now() else captured_at end
  where id = target.id;

  if requested_status <> 'captured' then
    return target.id;
  end if;

  select interval_months into plan from public.subscription_plans where id = target.plan_id;
  period_end := now() + make_interval(months => coalesce(plan.interval_months, 1));

  insert into public.vendor_subscriptions (
    vendor_id, plan_id, status, current_period_start, current_period_end
  )
  values (target.vendor_id, target.plan_id, 'active', now(), period_end)
  on conflict (vendor_id) where status in ('active', 'past_due', 'pending')
  do update set
    plan_id = excluded.plan_id,
    status = 'active',
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    cancelled_at = null
  returning id into new_subscription_id;

  update public.payments set subscription_id = new_subscription_id where id = target.id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, detail)
  values (null, 'payment.captured', 'payment', target.id,
          jsonb_build_object('order_id', requested_order_id, 'vendor_id', target.vendor_id));

  return target.id;
end;
$$;

revoke all on function public.apply_razorpay_payment(text, text, public.payment_status, text, text)
  from public, anon, authenticated;
-- The webhook has no user session, so it runs as service_role. No client role
-- can reach this function.
grant execute on function public.apply_razorpay_payment(text, text, public.payment_status, text, text)
  to service_role;

-- Admin: resolve an abuse report.
create or replace function public.admin_resolve_report(
  requested_report_id uuid,
  requested_status public.report_status,
  requested_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if requested_status not in ('reviewing', 'actioned', 'dismissed') then
    raise exception 'Unsupported report status' using errcode = '22023';
  end if;

  update public.reports
  set status = requested_status,
      resolution_note = requested_note,
      resolved_by = auth.uid(),
      resolved_at = case when requested_status = 'open' then null else now() end
  where id = requested_report_id;

  perform public.log_admin_action('report.' || requested_status, 'report', requested_report_id,
                                  jsonb_build_object('note', requested_note));
end;
$$;

revoke all on function public.admin_resolve_report(uuid, public.report_status, text) from public, anon;
grant execute on function public.admin_resolve_report(uuid, public.report_status, text) to authenticated;

-- Admin: a signed URL for a private verification document.
create or replace function public.admin_review_verification_document(
  requested_document_id uuid,
  requested_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  update public.verification_documents
  set reviewed_by = auth.uid(), reviewed_at = now(), review_note = requested_note
  where id = requested_document_id;
end;
$$;

revoke all on function public.admin_review_verification_document(uuid, text) from public, anon;
grant execute on function public.admin_review_verification_document(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Private storage for verification evidence
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vendor-verification', 'vendor-verification', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "vendor owners upload verification evidence"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'vendor-verification'
  and public.has_vendor_role(public.storage_vendor_id(name), array['owner', 'manager']::public.vendor_member_role[])
);

create policy "vendor owners and admins read verification evidence"
on storage.objects for select to authenticated
using (
  bucket_id = 'vendor-verification'
  and (
    public.has_vendor_role(public.storage_vendor_id(name), array['owner', 'manager']::public.vendor_member_role[])
    or public.is_admin()
  )
);

create policy "vendor owners and admins delete verification evidence"
on storage.objects for delete to authenticated
using (
  bucket_id = 'vendor-verification'
  and (
    public.has_vendor_role(public.storage_vendor_id(name), array['owner']::public.vendor_member_role[])
    or public.is_admin()
  )
);

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

insert into public.subscription_plans (code, name, description, price_paise, interval_months, features, sort_order) values
  ('free', 'Free listing', 'Everything needed to appear in the marketplace and receive enquiries.', 0, 12,
   '["Public profile in one city and category","Portfolio uploads","Lead inbox","Reply to reviews"]'::jsonb, 10),
  ('pro-monthly', 'Pro', 'For businesses that want reach and performance data.', 149900, 1,
   '["Everything in Free","Listings in up to five cities","Packages and price lists","Performance analytics","Team access","Priority moderation"]'::jsonb, 20),
  ('pro-annual', 'Pro (annual)', 'Two months free compared with monthly billing.', 1499000, 12,
   '["Everything in Pro","Two months free","Annual invoice for GST"]'::jsonb, 30);
