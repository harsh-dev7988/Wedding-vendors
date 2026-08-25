-- Structural and privilege assertions.
--
-- These prove the *shape* of the security model: RLS is on, the grants are
-- column-scoped, and the client role cannot reach the columns that carry
-- authority. Behavioural proof — that a policy actually refuses a read or a
-- write — lives in marketplace_rls.test.sql and marketplace_functions.test.sql.
begin;
select plan(38);

-- Row level security is enabled on every table holding business data.
select ok((select relrowsecurity from pg_class where oid = 'public.vendor_contacts'::regclass), 'vendor contacts has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.leads'::regclass), 'leads has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.lead_events'::regclass), 'lead events has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.contact_reveals'::regclass), 'contact reveal audit has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.shortlists'::regclass), 'shortlists has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.reviews'::regclass), 'reviews has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.audit_logs'::regclass), 'audit log has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.admin_roles'::regclass), 'admin roles has RLS enabled');

-- Deny by default: the private contact table is unreachable for anonymous
-- callers at the privilege layer, before any policy is consulted.
select ok(not has_table_privilege('anon', 'public.vendor_contacts', 'select'), 'anonymous users cannot select private contacts');
select ok(not has_table_privilege('anon', 'public.leads', 'select'), 'anonymous users cannot select leads');
select ok(not has_table_privilege('anon', 'public.contact_reveals', 'select'), 'anonymous users cannot select reveal audits');
select ok(not has_table_privilege('anon', 'public.admin_roles', 'select'), 'anonymous users cannot select admin roles');
select ok(not has_table_privilege('authenticated', 'public.admin_roles', 'select'), 'signed-in users cannot enumerate administrators');

-- Writes to the sensitive tables exist only through security-definer functions.
select ok(not has_table_privilege('authenticated', 'public.leads', 'insert'), 'clients cannot insert leads directly');
select ok(not has_table_privilege('authenticated', 'public.reviews', 'insert'), 'clients cannot insert reviews directly');
select ok(not has_table_privilege('authenticated', 'public.contact_reveals', 'insert'), 'clients cannot forge a reveal audit row');
select ok(not has_table_privilege('authenticated', 'public.vendors', 'insert'), 'clients cannot create a vendor outside the application flow');
select ok(not has_table_privilege('authenticated', 'public.audit_logs', 'insert'), 'clients cannot write to the audit log');

-- Public reads are column-scoped, so no auth user id or moderation note is
-- reachable with the browser-visible publishable key.
select ok(has_column_privilege('anon', 'public.reviews', 'body', 'select'), 'published review text is public');
select ok(not has_column_privilege('anon', 'public.reviews', 'customer_id', 'select'), 'reviewer auth ids are not public');
select ok(not has_column_privilege('anon', 'public.reviews', 'lead_id', 'select'), 'review-to-enquiry links are not public');
select ok(not has_column_privilege('anon', 'public.listings', 'moderation_note', 'select'), 'moderation notes are not public');
select ok(not has_column_privilege('anon', 'public.listings', 'moderated_by', 'select'), 'moderator identity is not public');
select ok(not has_column_privilege('anon', 'public.vendors', 'moderated_by', 'select'), 'vendor moderator identity is not public');
select ok(not has_column_privilege('anon', 'public.vendors', 'legal_name', 'select'), 'vendor legal name is not public');

-- Column grants are the wall that stops privilege escalation even where a
-- policy is permissive about which rows a member may touch.
select ok(has_column_privilege('authenticated', 'public.vendors', 'business_name', 'update'), 'vendors can update business identity copy');
select ok(not has_column_privilege('authenticated', 'public.vendors', 'status', 'update'), 'client role cannot update vendor approval status');
select ok(not has_column_privilege('authenticated', 'public.vendors', 'verified_at', 'update'), 'client role cannot self-verify');
select ok(has_column_privilege('authenticated', 'public.leads', 'status', 'update'), 'vendor client can update lead status');
select ok(not has_column_privilege('authenticated', 'public.leads', 'message', 'update'), 'vendor client cannot rewrite customer messages');
select ok(has_column_privilege('authenticated', 'public.reviews', 'vendor_reply', 'update'), 'vendor client can reply to eligible reviews');
select ok(not has_column_privilege('authenticated', 'public.reviews', 'rating', 'update'), 'vendor client cannot change customer ratings');
select ok(not has_column_privilege('authenticated', 'public.reviews', 'is_published', 'update'), 'client role cannot publish reviews');
select ok(not has_column_privilege('authenticated', 'public.listings', 'rating_avg', 'update'), 'client role cannot write its own rating aggregate');
select ok(not has_column_privilege('authenticated', 'public.listings', 'published_at', 'update'), 'client role cannot backdate publication');

-- Function reachability.
select ok(has_function_privilege('authenticated', 'public.submit_enquiry_and_reveal(uuid,date,text,integer)', 'execute'), 'authenticated users can submit validated enquiries');
select ok(not has_function_privilege('anon', 'public.submit_enquiry_and_reveal(uuid,date,text,integer)', 'execute'), 'anonymous users cannot call contact reveal');
select ok(not has_function_privilege('anon', 'public.get_revealed_contact(uuid)', 'execute'), 'anonymous users cannot read a revealed contact');
select ok(not has_function_privilege('anon', 'public.admin_moderate_vendor(uuid,text,text)', 'execute'), 'anonymous role cannot reach admin moderation');

select * from finish();
rollback;
