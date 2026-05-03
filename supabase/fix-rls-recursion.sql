-- ============================================
-- Fix: drop recursive policies + create SECURITY DEFINER helpers
-- Run this if you already applied the old migrate-collab.sql
-- ============================================

-- 1. Drop all broken policies
drop policy if exists "trip_members_select" on trip_members;
drop policy if exists "trip_members_insert" on trip_members;
drop policy if exists "trip_members_delete" on trip_members;

drop policy if exists "trip_invites_insert" on trip_invites;

drop policy if exists "trip_shop_items_select" on trip_shop_items;
drop policy if exists "trip_shop_items_insert" on trip_shop_items;
drop policy if exists "trip_shop_items_update" on trip_shop_items;
drop policy if exists "trip_shop_items_delete" on trip_shop_items;

drop policy if exists "trips_member_select" on trips;
drop policy if exists "trips_member_update" on trips;

-- 2. Create SECURITY DEFINER helpers (bypass RLS)
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

-- 3. Re-create policies using helper functions

-- trip_members
create policy "trip_members_select" on trip_members for select using (
  is_trip_member(trip_id)
  or exists (select 1 from trips t where t.id = trip_id and t.user_id = auth.uid())
);

create policy "trip_members_insert" on trip_members for insert with check (
  is_trip_owner_member(trip_id)
  or exists (select 1 from trips t where t.id = trip_id and t.user_id = auth.uid())
);

create policy "trip_members_delete" on trip_members for delete using (
  is_trip_owner_member(trip_id)
  or user_id = auth.uid()
);

-- trip_invites
create policy "trip_invites_insert" on trip_invites for insert with check (
  is_trip_editor(trip_id)
  or exists (select 1 from trips t where t.id = trip_id and t.user_id = auth.uid())
);

-- trip_shop_items
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

-- trips
create policy "trips_member_select" on trips for select using (
  auth.uid() = user_id
  or is_trip_member(id)
);

create policy "trips_member_update" on trips for update using (
  auth.uid() = user_id
  or is_trip_editor(id)
);
