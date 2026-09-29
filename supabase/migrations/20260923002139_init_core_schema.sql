-- ============================================================================
-- Initial core schema for edulab-api
-- ============================================================================
-- Notes:
--   * gen_random_uuid() has been built into PostgreSQL core (pg_catalog) since
--     PG13, so no `pgcrypto`/`uuid-ossp` extension is required to generate
--     surrogate UUID keys. Supabase's local/hosted Postgres major_version is
--     17 (see supabase/config.toml), so this is safe to rely on.
--   * All user references point at auth.users(id) directly -- there is no
--     public.users table by design. auth.users itself is never altered here;
--     the only touch on a Supabase-managed schema is an AFTER INSERT trigger
--     on auth.users that populates public.profiles, which is the standard,
--     Supabase-documented pattern for this exact use case.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------

create type public.resource_visibility as enum ('public', 'private');
create type public.resource_status as enum ('draft', 'published');

-- ----------------------------------------------------------------------------
-- Shared updated_at trigger function (reused by every table below that has
-- an updated_at column)
-- ----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- profiles
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  middle_name text,
  last_name text,
  profile_photo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Anyone (including unauthenticated callers) can view a profile.
create policy "profiles_select_all"
on public.profiles
for select
to anon, authenticated
using (true);

-- No INSERT policy: rows are created exclusively by the handle_new_user()
-- trigger below, which runs SECURITY DEFINER as the table owner and
-- therefore bypasses RLS. Clients cannot insert profile rows directly.

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "profiles_delete_own"
on public.profiles
for delete
to authenticated
using ((select auth.uid()) = id);

-- ----------------------------------------------------------------------------
-- auth.users -> public.profiles provisioning trigger
-- ----------------------------------------------------------------------------
-- Standard Supabase pattern: a SECURITY DEFINER function owned by the
-- migration role (table owner), so it bypasses RLS on public.profiles when
-- inserting. search_path is locked down and all objects are fully qualified
-- to avoid search_path hijacking. This function is only reachable as a
-- trigger (PL/pgSQL trigger functions error out if invoked directly via
-- RPC, since the NEW record only exists in trigger context), so no explicit
-- REVOKE is required to keep it safe from direct client calls.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============================================================================
-- resources
-- ============================================================================

create table public.resources (
  resource_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) > 0),
  description text,
  grade_level text,
  subject text,
  file text,
  visibility public.resource_visibility not null default 'public',
  status public.resource_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_resources_updated_at
before update on public.resources
for each row execute function public.set_updated_at();

-- Auto-stamp published_at the first time a resource transitions to
-- 'published'. Does not clear published_at on later transitions away from
-- 'published', so the original publish date is preserved as a historical
-- record even if the resource is unpublished and republished later.
create or replace function public.set_resource_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published'
     and new.published_at is null
     and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at = now();
  end if;
  return new;
end;
$$;

create trigger set_resources_published_at
before insert or update on public.resources
for each row execute function public.set_resource_published_at();

alter table public.resources enable row level security;

create index resources_user_id_idx on public.resources (user_id);

-- Supports the public resource feed: filter on visibility/status, order by
-- created_at desc with resource_id as a keyset-pagination tie-breaker.
create index resources_public_feed_idx
on public.resources (created_at desc, resource_id desc)
where visibility = 'public' and status = 'published';

create policy "resources_select_own"
on public.resources
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "resources_select_public"
on public.resources
for select
to anon, authenticated
using (visibility = 'public' and status = 'published');

create policy "resources_insert_own"
on public.resources
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "resources_update_own"
on public.resources
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "resources_delete_own"
on public.resources
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- ============================================================================
-- tags
-- ============================================================================

create table public.tags (
  tag_id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) > 0),
  created_at timestamptz not null default now()
);

alter table public.tags enable row level security;

create policy "tags_select_all"
on public.tags
for select
to anon, authenticated
using (true);

-- Shared vocabulary, no ownership concept: any authenticated user may add a
-- new tag. No UPDATE/DELETE policy -- effectively admin/service-role only.
create policy "tags_insert_authenticated"
on public.tags
for insert
to authenticated
with check (true);

-- ============================================================================
-- resource_tags (join table)
-- ============================================================================

create table public.resource_tags (
  resource_id uuid not null references public.resources (resource_id) on delete cascade,
  tag_id uuid not null references public.tags (tag_id) on delete cascade,
  primary key (resource_id, tag_id)
);

create index resource_tags_tag_id_idx on public.resource_tags (tag_id);

alter table public.resource_tags enable row level security;

-- Visible iff the parent resource is visible under the resources SELECT
-- policies above (owner, or public+published).
create policy "resource_tags_select"
on public.resource_tags
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.resources r
    where r.resource_id = resource_tags.resource_id
      and (
        r.user_id = (select auth.uid())
        or (r.visibility = 'public' and r.status = 'published')
      )
  )
);

create policy "resource_tags_insert_owner"
on public.resource_tags
for insert
to authenticated
with check (
  exists (
    select 1
    from public.resources r
    where r.resource_id = resource_tags.resource_id
      and r.user_id = (select auth.uid())
  )
);

create policy "resource_tags_delete_owner"
on public.resource_tags
for delete
to authenticated
using (
  exists (
    select 1
    from public.resources r
    where r.resource_id = resource_tags.resource_id
      and r.user_id = (select auth.uid())
  )
);

-- ============================================================================
-- bookmarks (save-for-later, pure toggle)
-- ============================================================================

create table public.bookmarks (
  user_id uuid not null references auth.users (id) on delete cascade,
  resource_id uuid not null references public.resources (resource_id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, resource_id)
);

create trigger set_bookmarks_updated_at
before update on public.bookmarks
for each row execute function public.set_updated_at();

create index bookmarks_resource_id_idx on public.bookmarks (resource_id);

alter table public.bookmarks enable row level security;

create policy "bookmarks_select_own"
on public.bookmarks
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "bookmarks_insert_own"
on public.bookmarks
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "bookmarks_delete_own"
on public.bookmarks
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- ============================================================================
-- stars (favorite toggle)
-- ============================================================================

create table public.stars (
  user_id uuid not null references auth.users (id) on delete cascade,
  resource_id uuid not null references public.resources (resource_id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, resource_id)
);

create trigger set_stars_updated_at
before update on public.stars
for each row execute function public.set_updated_at();

create index stars_resource_id_idx on public.stars (resource_id);

alter table public.stars enable row level security;

create policy "stars_select_own"
on public.stars
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "stars_insert_own"
on public.stars
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "stars_delete_own"
on public.stars
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- ============================================================================
-- comments
-- ============================================================================

create table public.comments (
  comment_id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources (resource_id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  parent_comment_id uuid references public.comments (comment_id) on delete set null,
  comment text not null check (char_length(comment) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_comments_updated_at
before update on public.comments
for each row execute function public.set_updated_at();

create index comments_resource_id_idx on public.comments (resource_id);
create index comments_user_id_idx on public.comments (user_id);
create index comments_parent_comment_id_idx on public.comments (parent_comment_id);

alter table public.comments enable row level security;

-- Visible iff the parent resource is visible (same pattern as resource_tags).
create policy "comments_select"
on public.comments
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.resources r
    where r.resource_id = comments.resource_id
      and (
        r.user_id = (select auth.uid())
        or (r.visibility = 'public' and r.status = 'published')
      )
  )
);

-- Any authenticated user may comment, as themselves, on a resource they can
-- currently see (owner, or public+published).
create policy "comments_insert_authenticated"
on public.comments
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.resources r
    where r.resource_id = comments.resource_id
      and (
        r.user_id = (select auth.uid())
        or (r.visibility = 'public' and r.status = 'published')
      )
  )
);

create policy "comments_update_own"
on public.comments
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "comments_delete_own"
on public.comments
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- ============================================================================
-- notifications
-- ============================================================================
-- OPEN DESIGN QUESTION (flagged for whoever builds the notifications
-- feature): there is deliberately no client-facing INSERT or DELETE policy
-- here. Recipients only get SELECT and UPDATE (their own rows). Creating a
-- notification therefore requires either:
--   (a) a SECURITY DEFINER trigger/function (e.g. on new comment insert,
--       notify the resource owner), or
--   (b) a service-role path from the NestJS backend, which bypasses RLS and
--       MUST verify in application code that the recipient (user_id) is
--       correct for the action being performed.
-- This migration does not implement either path; it only prepares the table
-- and its RLS so client reads/updates are safe today.

create table public.notifications (
  notification_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) > 0),
  description text,
  url text,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_notifications_updated_at
before update on public.notifications
for each row execute function public.set_updated_at();

create index notifications_user_id_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where is_read = false;

alter table public.notifications enable row level security;

create policy "notifications_select_own"
on public.notifications
for select
to authenticated
using ((select auth.uid()) = user_id);

-- RLS only enforces that a recipient can exclusively read/update their own
-- notifications; it does not restrict *which* columns an UPDATE may touch.
-- Restricting client updates to the is_read field only is left as an
-- application-layer (DTO) concern, per the access rules for this table.
create policy "notifications_update_own"
on public.notifications
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- ============================================================================
-- audit_logs
-- ============================================================================
-- OPEN DESIGN QUESTION (same as notifications above): there is no client
-- INSERT/UPDATE/DELETE policy at all. Rows are append-only and immutable by
-- design (no updated_at column). Writing an audit log entry needs a
-- system-level path -- a SECURITY DEFINER trigger on the actions being
-- audited, or a service-role write from the NestJS backend -- not client RLS.

create table public.audit_logs (
  audit_log_id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  action_title text not null check (char_length(action_title) > 0),
  description text,
  icon text,
  created_at timestamptz not null default now()
);

create index audit_logs_user_id_idx on public.audit_logs (user_id, created_at desc);

alter table public.audit_logs enable row level security;

create policy "audit_logs_select_own"
on public.audit_logs
for select
to authenticated
using ((select auth.uid()) = user_id);
