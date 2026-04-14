/* ═══════════════════════════════════════════════════════════════
   PEAK SOCIETY — Supabase Auth Migration
   Run in the Supabase SQL editor (Settings → SQL Editor)
   Execute the numbered steps IN ORDER.
   Step 4 (drop passwordHash) must be run AFTER all existing
   users have been migrated to Supabase Auth.
═══════════════════════════════════════════════════════════════ */


/* ─────────────────────────────────────────────────────────────
   STEP 1 — Add columns + constraints to public.users
───────────────────────────────────────────────────────────── */

-- 1a. Link to Supabase Auth
alter table public.users
  add column if not exists id uuid references auth.users(id) on delete cascade;

-- 1b. Email mirror (for username → email lookup on sign-in)
alter table public.users
  add column if not exists email text;

-- 1c. Role check constraint
alter table public.users
  drop constraint if exists users_role_check;

alter table public.users
  add constraint users_role_check
    check (role in ('owner', 'admin', 'staff', 'member'));

-- 1d. Unique index on id
alter table public.users
  drop constraint if exists users_id_unique;

alter table public.users
  add constraint users_id_unique unique (id);


/* ─────────────────────────────────────────────────────────────
   STEP 2 — Helper: get current user's role (used in RLS)
   security definer = runs as the function owner, bypasses RLS
   set search_path = public prevents search_path hijack
───────────────────────────────────────────────────────────── */

create or replace function public.get_my_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;


/* ─────────────────────────────────────────────────────────────
   STEP 3 — Trigger: auto-create public.users row on sign-up
   Inserts a new row when auth.users gets a new record.
   ON CONFLICT: if a row with that username already exists
   (migrated user), link the id and email without overwriting
   profile data.
───────────────────────────────────────────────────────────── */

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, username, email, role, joined)
  values (
    new.id,
    -- Use username from metadata set during signUp(), fall back to email prefix
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email,
    'member',
    current_date
  )
  on conflict (username) do update
    set id    = excluded.id,
        email = excluded.email;
  return new;
end;
$$;

-- Attach trigger to auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


/* ─────────────────────────────────────────────────────────────
   STEP 4 — Enable RLS and add policies
───────────────────────────────────────────────────────────── */

alter table public.users enable row level security;

-- Drop any old policies first so this script is safe to re-run
drop policy if exists "Public profiles are viewable by everyone" on public.users;
drop policy if exists "Users can update own profile"             on public.users;
drop policy if exists "Admins can update user roles"             on public.users;
drop policy if exists "Trigger-only inserts"                     on public.users;
drop policy if exists "Only owner can delete users"              on public.users;

-- Anyone (including anonymous) can read public profile fields
create policy "Public profiles are viewable by everyone"
  on public.users
  for select
  using (true);

-- Authenticated user can update their own non-role fields.
-- Self-role-escalation is blocked: role must stay the same unless
-- the actor is owner or admin.
create policy "Users can update own profile"
  on public.users
  for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and (
      role = (select role from public.users where id = auth.uid())
      or public.get_my_role() in ('owner', 'admin')
    )
  );

-- Owner and admin can update any user's role.
-- Only owner can assign the owner role.
create policy "Admins can update user roles"
  on public.users
  for update
  using (public.get_my_role() in ('owner', 'admin'))
  with check (
    role != 'owner' or public.get_my_role() = 'owner'
  );

-- Inserts are handled exclusively by the trigger (security definer bypasses RLS).
-- Block all direct inserts from the client.
create policy "Trigger-only inserts"
  on public.users
  for insert
  with check (false);

-- Only the owner can hard-delete user records.
create policy "Only owner can delete users"
  on public.users
  for delete
  using (public.get_my_role() = 'owner');


/* ─────────────────────────────────────────────────────────────
   STEP 5 — Drop passwordHash column
   !! ONLY RUN THIS AFTER all existing users have been migrated
   !! to Supabase Auth and have successfully signed in at least once.
   !! Verify: SELECT count(*) FROM public.users WHERE id IS NULL;
   !! should return 0 before running this.
───────────────────────────────────────────────────────────── */

-- Uncomment and run only when ready:
-- alter table public.users drop column if exists "passwordHash";
