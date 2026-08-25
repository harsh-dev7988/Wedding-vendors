-- ---------------------------------------------------------------------------
-- Abuse report queue
--
-- `reports` shipped with a table, indexes and read/insert policies, but with
-- no way to act on a row: `grant select, insert` gave nobody UPDATE, so an
-- administrator could see the queue and never close anything in it. These two
-- functions complete the loop and keep the same shape as the existing
-- `admin_moderate_*` family — security definer, admin check inside, every
-- decision written to `audit_logs`.
-- ---------------------------------------------------------------------------

-- Reading the queue needs the reporter's name and the reported title, which
-- live behind policies of their own. Resolving it in one security-definer
-- function avoids widening any table grant to satisfy a join.
create or replace function public.admin_list_reports(
  requested_status public.report_status default null,
  page_limit integer default 50,
  page_offset integer default 0
)
returns table (
  id uuid,
  reason public.report_reason,
  detail text,
  status public.report_status,
  created_at timestamptz,
  resolved_at timestamptz,
  resolution_note text,
  listing_id uuid,
  listing_title text,
  listing_slug text,
  listing_status public.listing_status,
  review_id uuid,
  review_body text,
  reporter_name text,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with visible as (
    select r.*
    from public.reports r
    where public.is_admin()
      and (requested_status is null or r.status = requested_status)
  )
  select
    v.id,
    v.reason,
    v.detail,
    v.status,
    v.created_at,
    v.resolved_at,
    v.resolution_note,
    v.listing_id,
    l.title,
    l.slug,
    l.status,
    v.review_id,
    rev.body,
    coalesce(p.full_name, 'Deleted account'),
    count(*) over ()
  from visible v
  left join public.listings l on l.id = v.listing_id
  left join public.reviews rev on rev.id = v.review_id
  left join public.profiles p on p.id = v.reporter_id
  -- Open first, then oldest first: the queue is worked from the top and a
  -- report that has waited longest is the one most likely to matter.
  order by (v.status = 'open'::public.report_status) desc, v.created_at
  limit greatest(1, least(coalesce(page_limit, 50), 100))
  offset greatest(0, coalesce(page_offset, 0));
$$;

create or replace function public.admin_resolve_report(
  requested_report_id uuid,
  requested_action text,
  requested_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_status public.report_status;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  next_status := case requested_action
    when 'start' then 'reviewing'
    when 'action' then 'actioned'
    when 'dismiss' then 'dismissed'
    when 'reopen' then 'open'
  end;

  if next_status is null then
    raise exception 'Unsupported report action' using errcode = '22023';
  end if;

  if requested_note is not null and char_length(requested_note) > 2000 then
    raise exception 'Resolution note is too long' using errcode = '22001';
  end if;

  update public.reports
  set status = next_status,
      resolution_note = coalesce(nullif(trim(requested_note), ''), resolution_note),
      -- Reopening clears the closure, so a reopened report is not shown as
      -- resolved by whoever last closed it.
      resolved_by = case when next_status in ('actioned', 'dismissed') then auth.uid() end,
      resolved_at = case when next_status in ('actioned', 'dismissed') then now() end
  where id = requested_report_id;

  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;

  perform public.log_admin_action(
    'report.' || requested_action,
    'report',
    requested_report_id,
    jsonb_build_object('status', next_status)
  );
end;
$$;

revoke all on function public.admin_list_reports(public.report_status, integer, integer) from public, anon;
revoke all on function public.admin_resolve_report(uuid, text, text) from public, anon;
grant execute on function public.admin_list_reports(public.report_status, integer, integer) to authenticated;
grant execute on function public.admin_resolve_report(uuid, text, text) to authenticated;

-- The unique index only covers listing reports, so a review could be reported
-- by the same person repeatedly. Close that the same way.
create unique index if not exists reports_reporter_review_idx
  on public.reports (reporter_id, review_id)
  where status = 'open' and review_id is not null;
