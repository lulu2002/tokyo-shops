-- Admin users table
create table if not exists admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table admin_users enable row level security;
create policy "admin_public_read" on admin_users for select using (true);

-- Update shops RLS: only admins can write
drop policy if exists "shops_auth_write" on shops;
create policy "shops_admin_write" on shops for all to authenticated
  using (exists (select 1 from admin_users where user_id = auth.uid()))
  with check (exists (select 1 from admin_users where user_id = auth.uid()));

-- Update categories RLS: only admins can write
drop policy if exists "categories_auth_write" on categories;
create policy "categories_admin_write" on categories for all to authenticated
  using (exists (select 1 from admin_users where user_id = auth.uid()))
  with check (exists (select 1 from admin_users where user_id = auth.uid()));

-- Update shop_categories RLS: only admins can write
drop policy if exists "shop_categories_auth_write" on shop_categories;
create policy "shop_categories_admin_write" on shop_categories for all to authenticated
  using (exists (select 1 from admin_users where user_id = auth.uid()))
  with check (exists (select 1 from admin_users where user_id = auth.uid()));

-- After running this, add yourself as admin:
-- INSERT INTO admin_users (user_id) VALUES ('YOUR-USER-ID-HERE');
