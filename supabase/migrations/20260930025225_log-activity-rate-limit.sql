-- ============================================================================
-- log_activity(): per-user rate limit + length caps
-- ============================================================================
-- Security review finding: log_activity() is SECURITY DEFINER and EXECUTE is
-- granted to `authenticated`, so any client holding a valid Supabase session
-- JWT can call it directly via
-- `POST {SUPABASE_URL}/rest/v1/rpc/log_activity`, bypassing NestJS's
-- app-level ThrottlerModule (100/min global) entirely. This is not a
-- cross-user integrity issue -- attribution to auth.uid() was already solid
-- and independently re-verified -- but combined with no upper bound on
-- action_title/description length, a user could flood their own audit_logs
-- with arbitrarily many, arbitrarily large rows at a rate bounded only by
-- Supabase's platform gateway, not this app's throttling.
--
-- Fix, defense in depth:
--   1. Per-user rate limit enforced inside the function itself (not just in
--      NestJS): reject the call if the caller already has 30+ rows in
--      public.audit_logs in the trailing 60 seconds. Raises an exception,
--      matching the function's existing "requires an authenticated caller"
--      pattern, so the caller/NestJS side gets a real error to log rather
--      than a silent no-op or a silently dropped row.
--   2. Length caps enforced at the table level via `check` constraints (so
--      any future write path to audit_logs is also bounded, not just this
--      function), plus a matching pre-check inside the function that raises
--      a clear exception -- consistent with the function's existing style of
--      raising on invalid input rather than silently truncating it.
--
-- Known limitation: the rate-limit check is read-then-insert, not atomic
-- with a lock, so two concurrent calls from the same user near the boundary
-- could both read count = 29 and both insert, landing at 31 rows instead of
-- being capped at exactly 30. That race is acceptable here -- this is an
-- abuse-mitigation backstop against unbounded flooding, not a hard security
-- boundary, and it does not affect cross-user integrity.
--
-- CREATE OR REPLACE FUNCTION note: per the PostgreSQL docs for
-- CREATE FUNCTION, "when CREATE OR REPLACE FUNCTION is used to replace an
-- existing function, the ownership and permissions of the function do not
-- change" -- privileges are only (re)initialized when the function is newly
-- created. The signature here, (text, text default null, text default
-- null), is byte-for-byte unchanged from
-- 20260930022900_log-activity-function.sql, so this is a true "replace" and
-- the prior `revoke ... from public/anon` + `grant ... to authenticated`
-- ACLs are preserved. The revoke/grant statements are re-issued below anyway
-- so this migration is self-contained and re-runnable on its own.
-- ============================================================================

-- Table-level length caps: defense in depth so any future write path to
-- audit_logs (not only log_activity) is also bounded. char_length() of a
-- null value is null, and a null check-constraint result is treated as
-- satisfied, so these still allow description to be omitted.
alter table public.audit_logs
  add constraint audit_logs_action_title_length_check
  check (char_length(action_title) <= 200);

alter table public.audit_logs
  add constraint audit_logs_description_length_check
  check (description is null or char_length(description) <= 2000);

create or replace function public.log_activity(
  p_action_title text,
  p_description text default null,
  p_icon text default null
)
returns public.audit_logs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.audit_logs;
  v_recent_count integer;
begin
  if auth.uid() is null then
    raise exception 'log_activity requires an authenticated caller';
  end if;

  if p_action_title is null or char_length(p_action_title) = 0 then
    raise exception 'log_activity requires a non-empty action_title';
  end if;

  if char_length(p_action_title) > 200 then
    raise exception 'log_activity: action_title must be 200 characters or fewer';
  end if;

  if p_description is not null and char_length(p_description) > 2000 then
    raise exception 'log_activity: description must be 2000 characters or fewer';
  end if;

  -- Per-user rate limit: relies on audit_logs_user_id_idx
  -- (user_id, created_at desc), so this is an index-only range scan on the
  -- calling user's own rows, not a table scan.
  select count(*)
  into v_recent_count
  from public.audit_logs
  where user_id = auth.uid()
    and created_at >= now() - interval '1 minute';

  if v_recent_count >= 30 then
    raise exception 'log_activity rate limit exceeded: too many activity log entries in the last minute';
  end if;

  insert into public.audit_logs (user_id, action_title, description, icon)
  values (auth.uid(), p_action_title, p_description, p_icon)
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.log_activity(text, text, text) from public;
revoke execute on function public.log_activity(text, text, text) from anon;
grant execute on function public.log_activity(text, text, text) to authenticated;
