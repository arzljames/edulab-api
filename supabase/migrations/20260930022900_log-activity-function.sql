-- ============================================================================
-- log_activity(): resolves the audit_logs open design question
-- ============================================================================
-- Notes:
--   * public.audit_logs (see 20260923002139_init_core_schema.sql) has no
--     client-facing INSERT/UPDATE/DELETE policy by design -- entries are
--     append-only and must always be attributed to the caller themselves.
--   * This project has never used the service-role key (see CLAUDE.md), so
--     the write path chosen here is a SECURITY DEFINER function rather than
--     a service-role insert from NestJS. The function bypasses RLS on
--     public.audit_logs internally, but only ever inserts a row where
--     user_id = auth.uid() of the calling session -- a caller can never
--     attribute an entry to another user, and an unauthenticated call
--     (auth.uid() is null) is rejected outright.
--   * search_path is locked down and all objects are fully qualified to
--     avoid search_path hijacking, matching the pattern used by
--     public.handle_new_user() and public.set_updated_at() in the init
--     migration.
--   * EXECUTE is revoked from public/anon and granted only to authenticated,
--     since (unlike handle_new_user, which is only reachable as an
--     auth.users trigger) this function is directly callable via
--     `.rpc('log_activity', ...)` and Postgres grants EXECUTE to PUBLIC by
--     default on function creation.
-- ============================================================================

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
begin
  if auth.uid() is null then
    raise exception 'log_activity requires an authenticated caller';
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
