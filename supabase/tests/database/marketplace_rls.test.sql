-- Adversarial RLS: two customers, two vendors, one admin.
--
-- Every assertion here performs a real read or write as a specific JWT and
-- checks what came back. Privilege introspection cannot catch a policy that is
-- simply wrong, which is what these cover.
begin;
select plan(24);

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

create or replace function tests.anon() returns void
language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
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

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
select tests.new_user('11111111-1111-1111-1111-111111111111', 'customer.a@example.com');
select tests.new_user('22222222-2222-2222-2222-222222222222', 'customer.b@example.com');
select tests.new_user('33333333-3333-3333-3333-333333333333', 'owner.one@example.com');
select tests.new_user('44444444-4444-4444-4444-444444444444', 'owner.two@example.com');
select tests.new_user('55555555-5555-5555-5555-555555555555', 'admin@example.com');
select tests.new_user('66666666-6666-6666-6666-666666666666', 'editor.one@example.com');

insert into public.admin_roles (user_id) values ('55555555-5555-5555-5555-555555555555');

insert into public.vendors (id, business_name, status, verified_at, verification_expires_at)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Vendor One', 'approved', now(), now() + interval '12 months'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Vendor Two', 'approved', now(), now() + interval '12 months');

insert into public.vendor_members (vendor_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'owner'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666', 'editor'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 'owner');

insert into public.vendor_contacts (vendor_id, phone_e164, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '+919876543210', 'one@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '+919876543211', 'two@example.com');

insert into public.listings (
  id, vendor_id, category_id, primary_city_id, slug, title, summary, description, status, published_at
) values (
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  (select id from public.categories where slug = 'venues'),
  (select id from public.cities where slug = 'mumbai'),
  'vendor-one-venue', 'Vendor One Venue',
  'A published venue listing used for row level security tests.',
  'A published venue listing used for row level security tests. It is long enough to satisfy the description length constraint.',
  'published', now()
), (
  'bbbbbbbb-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000002',
  (select id from public.categories where slug = 'venues'),
  (select id from public.cities where slug = 'mumbai'),
  'vendor-two-draft', 'Vendor Two Draft',
  'An unpublished draft listing used for row level security tests.',
  'An unpublished draft listing used for row level security tests. It is long enough to satisfy the description length constraint.',
  'draft', null
);

insert into public.leads (id, listing_id, customer_id, event_date, message) values
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', current_date + 30,
   'Customer A enquiry message that is long enough to pass validation.');

insert into public.contact_reveals (lead_id, customer_id, vendor_id) values
  ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0000-0000-0000-000000000001');

insert into public.shortlists (customer_id, listing_id) values
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000001');

insert into public.reviews (id, lead_id, listing_id, customer_id, rating, body, is_published) values
  ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   5, 'An unpublished review body that is comfortably over thirty characters long.', false);

-- ---------------------------------------------------------------------------
-- Anonymous visitor
-- ---------------------------------------------------------------------------
select tests.anon();

select is(
  (select count(*) from public.listings)::int, 1,
  'anonymous sees only the published listing of an approved vendor'
);
select is(
  (select count(*) from public.reviews)::int, 0,
  'anonymous cannot read an unpublished review'
);
select throws_ok(
  $$ select phone_e164 from public.vendor_contacts $$,
  '42501',
  null,
  'anonymous is refused at the privilege layer on vendor_contacts'
);

-- ---------------------------------------------------------------------------
-- Customer A owns the lead, the reveal, the shortlist and the review
-- ---------------------------------------------------------------------------
select tests.login('11111111-1111-1111-1111-111111111111');

select is((select count(*) from public.leads)::int, 1, 'customer A sees their own lead');
select is((select count(*) from public.contact_reveals)::int, 1, 'customer A sees their own reveal audit');
select is((select count(*) from public.shortlists)::int, 1, 'customer A sees their own shortlist');
select is((select count(*) from public.reviews)::int, 1, 'customer A sees their own unpublished review');
select is(
  (select phone from public.get_revealed_contact('cccccccc-0000-0000-0000-000000000001')),
  '+919876543210',
  'customer A can re-open the contact revealed to them'
);

-- ---------------------------------------------------------------------------
-- Customer B must see none of it
-- ---------------------------------------------------------------------------
select tests.login('22222222-2222-2222-2222-222222222222');

select is((select count(*) from public.leads)::int, 0, 'customer B cannot read another customer''s lead');
select is((select count(*) from public.contact_reveals)::int, 0, 'customer B cannot read another customer''s reveal audit');
select is((select count(*) from public.shortlists)::int, 0, 'customer B cannot read another customer''s shortlist');
select is((select count(*) from public.reviews)::int, 0, 'customer B cannot read an unpublished review');
select is(
  (select count(*) from public.get_revealed_contact('cccccccc-0000-0000-0000-000000000001'))::int,
  0,
  'customer B cannot reach a contact revealed to someone else'
);
select is(
  (select count(*) from public.vendor_contacts)::int, 0,
  'a signed-in stranger cannot read any private vendor contact'
);
select lives_ok(
  $$ insert into public.shortlists (customer_id, listing_id)
     values ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-000000000001') $$,
  'customer B can shortlist a published listing'
);
select throws_ok(
  $$ insert into public.shortlists (customer_id, listing_id)
     values ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000002') $$,
  '42501',
  null,
  'customer B cannot shortlist on behalf of another customer, nor an unpublished listing'
);

-- ---------------------------------------------------------------------------
-- Vendor Two must not reach Vendor One's data
-- ---------------------------------------------------------------------------
select tests.login('44444444-4444-4444-4444-444444444444');

select is(
  (select count(*) from public.leads)::int, 0,
  'a vendor cannot read leads belonging to another vendor'
);
select is(
  (select count(*) from public.vendor_contacts)::int, 1,
  'a vendor owner reads only their own private contact row'
);
select is(
  (select count(*) from public.vendor_contacts where vendor_id = 'aaaaaaaa-0000-0000-0000-000000000001')::int,
  0,
  'a vendor cannot read a competitor''s private contact'
);
select results_eq(
  $$ update public.leads set status = 'closed'
     where id = 'cccccccc-0000-0000-0000-000000000001' returning id $$,
  $$ select null::uuid where false $$,
  'a vendor cannot close another vendor''s lead to unlock a review'
);

-- ---------------------------------------------------------------------------
-- Vendor One: suspension must be sticky, and roles must be enforced
-- ---------------------------------------------------------------------------
select tests.logout();
update public.listings set status = 'suspended', suspended_by_cascade = false
where id = 'bbbbbbbb-0000-0000-0000-000000000001';

select tests.login('33333333-3333-3333-3333-333333333333');
select results_eq(
  $$ update public.listings set status = 'draft'
     where id = 'bbbbbbbb-0000-0000-0000-000000000001' returning id $$,
  $$ select null::uuid where false $$,
  'a suspended listing cannot be returned to draft by its own vendor'
);

select tests.logout();
update public.listings set status = 'published' where id = 'bbbbbbbb-0000-0000-0000-000000000001';

-- An editor may author listings but must not touch the business profile.
select tests.login('66666666-6666-6666-6666-666666666666');
select results_eq(
  $$ update public.vendors set business_name = 'Renamed By Editor'
     where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning id $$,
  $$ select null::uuid where false $$,
  'an editor cannot rename the business'
);
select is(
  (select count(*) from public.vendor_contacts)::int, 0,
  'an editor cannot read the private contact row'
);

-- ---------------------------------------------------------------------------
-- Administrator
-- ---------------------------------------------------------------------------
select tests.login('55555555-5555-5555-5555-555555555555');
select ok(public.is_admin(), 'the seeded administrator is recognised');
select ok(
  (select count(*) from public.leads) >= 1,
  'an administrator can read leads for moderation'
);

select * from finish();
rollback;
