-- Behaviour of the constraints and security-definer functions.
--
-- The first two assertions exist because a doubled backslash in the E.164 and
-- email patterns made every real phone number and email address fail, which
-- silently disabled vendor onboarding and therefore every downstream flow.
begin;
select plan(22);

create schema if not exists tests;

create or replace function tests.login(user_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', user_id::text, 'role', 'authenticated')::text,
    true
  );
end;
$$;

create or replace function tests.logout() returns void
language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function tests.new_user(user_id uuid, user_email text) returns void
language plpgsql as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) values (
    '00000000-0000-0000-0000-000000000000', user_id, 'authenticated',
    'authenticated', user_email, '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  );
end;
$$;

select tests.new_user('11111111-1111-1111-1111-111111111111', 'customer@example.com');
select tests.new_user('33333333-3333-3333-3333-333333333333', 'owner@example.com');
select tests.new_user('55555555-5555-5555-5555-555555555555', 'admin@example.com');
insert into public.admin_roles (user_id) values ('55555555-5555-5555-5555-555555555555');

-- ---------------------------------------------------------------------------
-- Contact format constraints
-- ---------------------------------------------------------------------------
insert into public.vendors (id, business_name, status)
values ('aaaaaaaa-0000-0000-0000-000000000009', 'Constraint Fixture', 'pending_review');

select lives_ok(
  $$ insert into public.vendor_contacts (vendor_id, phone_e164, email)
     values ('aaaaaaaa-0000-0000-0000-000000000009', '+919876543210', 'owner@studio.co.in') $$,
  'a real Indian E.164 number and a real email are accepted'
);
select throws_ok(
  $$ update public.vendor_contacts set phone_e164 = '919876543210'
     where vendor_id = 'aaaaaaaa-0000-0000-0000-000000000009' $$,
  '23514',
  null,
  'a number without the leading plus is rejected'
);
select throws_ok(
  $$ update public.vendor_contacts set email = 'not-an-email'
     where vendor_id = 'aaaaaaaa-0000-0000-0000-000000000009' $$,
  '23514',
  null,
  'a malformed email is rejected'
);

-- ---------------------------------------------------------------------------
-- Vendor application
-- ---------------------------------------------------------------------------
select tests.login('33333333-3333-3333-3333-333333333333');

select isnt(
  public.start_vendor_application('Bright Studio', '+919812345678', 'hello@bright.example'),
  null,
  'a vendor application succeeds end to end with a real phone number'
);
select is(
  (select role::text from public.vendor_members where user_id = '33333333-3333-3333-3333-333333333333' limit 1),
  'owner',
  'the applicant becomes the owner of the new business'
);
select throws_ok(
  $$ select public.start_vendor_application('Bad Phone', '98765 43210', null) $$,
  '22023',
  null,
  'an unnormalised phone number is refused by the function'
);

-- ---------------------------------------------------------------------------
-- Enquiry limits, cooldown and reveal
-- ---------------------------------------------------------------------------
select tests.logout();

update public.vendors set status = 'approved', verified_at = now(),
  verification_expires_at = now() + interval '12 months'
where id = 'aaaaaaaa-0000-0000-0000-000000000009';

insert into public.listings (
  id, vendor_id, category_id, primary_city_id, slug, title, summary, description, status, published_at
) values (
  'bbbbbbbb-0000-0000-0000-000000000009',
  'aaaaaaaa-0000-0000-0000-000000000009',
  (select id from public.categories where slug = 'venues'),
  (select id from public.cities where slug = 'mumbai'),
  'constraint-fixture-venue', 'Constraint Fixture Venue',
  'A published listing used by the enquiry and review function tests.',
  'A published listing used by the enquiry and review function tests. It is long enough to satisfy the description length constraint.',
  'published', now()
);

select tests.login('11111111-1111-1111-1111-111111111111');

select is(
  (select count(*) from public.submit_enquiry_and_reveal(
     'bbbbbbbb-0000-0000-0000-000000000009', current_date + 40,
     'A first enquiry message that is comfortably over twenty characters.'))::int,
  1,
  'a validated enquiry returns the vendor contact to the caller'
);
select is(
  (select count(*) from public.contact_reveals)::int, 1,
  'the reveal is audited in the same transaction as the lead'
);
select throws_ok(
  $$ select public.submit_enquiry_and_reveal(
       'bbbbbbbb-0000-0000-0000-000000000009', current_date + 41,
       'A second enquiry to the same vendor inside the cooldown window.') $$,
  'P0001',
  null,
  'the 15-minute per-vendor cooldown is enforced'
);
select throws_ok(
  $$ select public.submit_enquiry_and_reveal(
       'bbbbbbbb-0000-0000-0000-000000000009', current_date - 1,
       'An enquiry for an event date that has already passed entirely.') $$,
  '22023',
  null,
  'a past event date is refused'
);
select throws_ok(
  $$ select public.submit_enquiry_and_reveal(
       'bbbbbbbb-0000-0000-0000-000000000009', current_date + 40, 'too short') $$,
  '22023',
  null,
  'a message under twenty characters is refused'
);

-- Backdate the first lead, then fill the daily quota to prove the cap fires.
select tests.logout();
update public.leads set created_at = now() - interval '20 minutes'
where customer_id = '11111111-1111-1111-1111-111111111111';

select tests.login('11111111-1111-1111-1111-111111111111');
select lives_ok(
  $$ select public.submit_enquiry_and_reveal(
       'bbbbbbbb-0000-0000-0000-000000000009', current_date + 42,
       'A follow-up enquiry sent after the cooldown window has elapsed.') $$,
  'a repeat enquiry is allowed once the cooldown has elapsed'
);

select tests.logout();
insert into public.leads (listing_id, customer_id, event_date, message)
select 'bbbbbbbb-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111',
       current_date + 50, 'Filler lead used to reach the daily enquiry quota.'
from generate_series(1, 3);
update public.leads set created_at = now() - interval '20 minutes'
where customer_id = '11111111-1111-1111-1111-111111111111';

select tests.login('11111111-1111-1111-1111-111111111111');
select throws_ok(
  $$ select public.submit_enquiry_and_reveal(
       'bbbbbbbb-0000-0000-0000-000000000009', current_date + 60,
       'A sixth enquiry inside 24 hours, which must be refused outright.') $$,
  'P0001',
  null,
  'the five-per-24-hours cap is enforced'
);

-- ---------------------------------------------------------------------------
-- Review eligibility
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.submit_review(
       (select id from public.leads where customer_id = '11111111-1111-1111-1111-111111111111' order by created_at limit 1),
       5::smallint,
       'A review written before the enquiry is eligible for any review at all.') $$,
  'P0002',
  null,
  'a review is refused while the enquiry is neither closed nor 14 days past the event'
);

select tests.logout();
update public.leads set status = 'closed'
where id = (select id from public.leads where customer_id = '11111111-1111-1111-1111-111111111111' order by created_at limit 1);

select tests.login('11111111-1111-1111-1111-111111111111');
select isnt(
  public.submit_review(
    (select id from public.leads where customer_id = '11111111-1111-1111-1111-111111111111' order by created_at limit 1),
    5::smallint,
    'A perfectly good review written once the enquiry has been marked complete.'),
  null,
  'a closed enquiry unlocks the review'
);
select throws_ok(
  $$ select public.submit_review(
       (select id from public.leads where customer_id = '11111111-1111-1111-1111-111111111111' order by created_at limit 1),
       4::smallint,
       'A second review for the very same enquiry, which must be refused.') $$,
  'P0001',
  null,
  'one enquiry yields at most one review'
);

-- Aggregates follow moderation, not submission.
select is(
  (select rating_count from public.listings where id = 'bbbbbbbb-0000-0000-0000-000000000009'),
  0,
  'an unpublished review does not move the public rating'
);

select tests.logout();
update public.reviews set is_published = true;
select is(
  (select rating_count from public.listings where id = 'bbbbbbbb-0000-0000-0000-000000000009'),
  1,
  'publishing a review updates the trigger-maintained rating count'
);

-- ---------------------------------------------------------------------------
-- Administrator authorisation and publication prerequisites
-- ---------------------------------------------------------------------------
select tests.login('11111111-1111-1111-1111-111111111111');
select throws_ok(
  $$ select public.admin_moderate_vendor('aaaaaaaa-0000-0000-0000-000000000009', 'suspend') $$,
  '42501',
  null,
  'a customer calling an admin function is refused by the function itself'
);
select throws_ok(
  $$ select public.admin_moderate_listing('bbbbbbbb-0000-0000-0000-000000000009', 'publish') $$,
  '42501',
  null,
  'a customer cannot publish a listing'
);

select tests.login('55555555-5555-5555-5555-555555555555');
select throws_ok(
  $$ select public.admin_moderate_listing('bbbbbbbb-0000-0000-0000-000000000009', 'publish') $$,
  '22023',
  null,
  'publication is refused while the listing has no portfolio image'
);
select throws_ok(
  $$ select public.admin_moderate_listing('bbbbbbbb-0000-0000-0000-000000000009', 'delete-everything') $$,
  '22023',
  null,
  'an unknown moderation action is refused'
);

select * from finish();
rollback;
