-- ============================================
-- User Profiles (public-readable for collab)
-- ============================================
create table user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

alter table user_profiles enable row level security;
create policy "profiles_public_read" on user_profiles for select using (true);
create policy "profiles_owner_upsert" on user_profiles for insert with check (auth.uid() = user_id);
create policy "profiles_owner_update" on user_profiles for update using (auth.uid() = user_id);

-- ============================================
-- Trip Members (collaborators)
-- ============================================
create table trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  joined_at timestamptz not null default now(),
  unique (trip_id, user_id)
);

alter table trip_members enable row level security;

-- ============================================
-- SECURITY DEFINER helpers to break RLS recursion
--
-- Problem: trip_members SELECT policy can't query trip_members
-- (infinite recursion). These functions bypass RLS internally.
-- ============================================

create or replace function is_trip_member(p_trip_id uuid)
returns boolean as $$
  select exists(
    select 1 from trip_members where trip_id = p_trip_id and user_id = auth.uid()
  )
$$ language sql security definer stable;

create or replace function is_trip_editor(p_trip_id uuid)
returns boolean as $$
  select exists(
    select 1 from trip_members where trip_id = p_trip_id and user_id = auth.uid() and role in ('owner', 'editor')
  )
$$ language sql security definer stable;

create or replace function is_trip_owner_member(p_trip_id uuid)
returns boolean as $$
  select exists(
    select 1 from trip_members where trip_id = p_trip_id and user_id = auth.uid() and role = 'owner'
  )
$$ language sql security definer stable;

-- ============================================
-- Trip Members RLS (using helper functions)
-- ============================================

-- You can see all members of any trip you belong to (or own)
create policy "trip_members_select" on trip_members for select using (
  is_trip_member(trip_id)
  or exists (select 1 from trips t where t.id = trip_id and t.user_id = auth.uid())
);

-- Trip owner (via trips table or member role) can add members
create policy "trip_members_insert" on trip_members for insert with check (
  is_trip_owner_member(trip_id)
  or exists (select 1 from trips t where t.id = trip_id and t.user_id = auth.uid())
);

-- Owner can remove members, or member can leave (remove own row)
create policy "trip_members_delete" on trip_members for delete using (
  is_trip_owner_member(trip_id)
  or user_id = auth.uid()
);

-- ============================================
-- Trip Invites (share link tokens)
-- ============================================
create table trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  role text not null default 'editor' check (role in ('editor', 'viewer')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table trip_invites enable row level security;

-- Anyone can read an invite (needed for join flow — they access by UUID)
create policy "trip_invites_select" on trip_invites for select using (true);

-- Owner or editor can create invites
create policy "trip_invites_insert" on trip_invites for insert with check (
  is_trip_editor(trip_id)
  or exists (select 1 from trips t where t.id = trip_id and t.user_id = auth.uid())
);

-- ============================================
-- Trip Shop Items (replaces shop_ids integer[])
-- ============================================
create table trip_shop_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  shop_id integer not null references shops(id) on delete cascade,
  sort_order integer not null default 0,
  visited boolean not null default false,
  duration_override integer,
  added_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (trip_id, shop_id)
);

alter table trip_shop_items enable row level security;

create policy "trip_shop_items_select" on trip_shop_items for select using (
  is_trip_member(trip_id)
  or exists (select 1 from trips t where t.id = trip_id and t.user_id = auth.uid())
);

create policy "trip_shop_items_insert" on trip_shop_items for insert with check (
  is_trip_editor(trip_id)
  or exists (select 1 from trips t where t.id = trip_id and t.user_id = auth.uid())
);

create policy "trip_shop_items_update" on trip_shop_items for update using (
  is_trip_editor(trip_id)
  or exists (select 1 from trips t where t.id = trip_id and t.user_id = auth.uid())
);

create policy "trip_shop_items_delete" on trip_shop_items for delete using (
  is_trip_editor(trip_id)
  or exists (select 1 from trips t where t.id = trip_id and t.user_id = auth.uid())
);

-- ============================================
-- Trips table additions
-- ============================================
alter table trips add column if not exists is_collaborative boolean not null default false;

-- Update trips RLS to allow member access (using helper function)
drop policy if exists "trips_owner_select" on trips;
drop policy if exists "trips_owner_update" on trips;

create policy "trips_member_select" on trips for select using (
  auth.uid() = user_id
  or is_trip_member(id)
);

create policy "trips_member_update" on trips for update using (
  auth.uid() = user_id
  or is_trip_editor(id)
);

-- Keep existing insert/delete policies (owner only)
-- trips_owner_insert and trips_owner_delete remain unchanged

-- ============================================
-- Enable Realtime for collaborative tables
-- ============================================
alter publication supabase_realtime add table trip_shop_items;
alter publication supabase_realtime add table trips;

-- ============================================
-- Backfill: create owner member records for existing trips
-- ============================================
insert into trip_members (trip_id, user_id, role)
select id, user_id, 'owner' from trips
on conflict (trip_id, user_id) do nothing;

-- ============================================
-- Function: join trip via invite
-- (Handles insert into trip_members from invite token)
-- ============================================
create or replace function join_trip_via_invite(invite_id uuid)
returns jsonb as $$
declare
  v_invite record;
  v_trip record;
begin
  select * into v_invite from trip_invites where id = invite_id;
  if v_invite is null then
    return jsonb_build_object('error', 'INVITE_NOT_FOUND');
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    return jsonb_build_object('error', 'INVITE_EXPIRED');
  end if;

  select * into v_trip from trips where id = v_invite.trip_id;
  if v_trip is null then
    return jsonb_build_object('error', 'TRIP_NOT_FOUND');
  end if;

  -- Check if already a member
  if exists (select 1 from trip_members where trip_id = v_invite.trip_id and user_id = auth.uid()) then
    return jsonb_build_object('ok', true, 'trip_id', v_invite.trip_id, 'already_member', true);
  end if;

  insert into trip_members (trip_id, user_id, role)
  values (v_invite.trip_id, auth.uid(), v_invite.role);

  return jsonb_build_object('ok', true, 'trip_id', v_invite.trip_id, 'role', v_invite.role);
end;
$$ language plpgsql security definer;
