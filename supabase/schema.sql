-- ============================================
-- Categories (系統固定分類)
-- ============================================
create table categories (
  id serial primary key,
  slug text unique not null,
  name text not null,
  label text not null,
  color text not null default 'bg-gray-500',
  sort_order integer not null default 0
);

alter table categories enable row level security;
create policy "categories_public_read" on categories for select using (true);
create policy "categories_auth_write" on categories for all to authenticated using (true) with check (true);

-- ============================================
-- Shops
-- ============================================
create table shops (
  id serial primary key,
  name text not null,
  subcategory text not null default '',
  specialty text not null default '',
  description text not null default '',
  location text not null default '',
  price text not null default '',
  lat double precision not null default 0,
  lng double precision not null default 0,
  photo_url text not null default '',
  photos text[] not null default '{}',
  slug text not null default '',
  rating double precision not null default 0,
  review_count integer not null default 0,
  address text not null default '',
  website text not null default '',
  google_maps_url text not null default '',
  hours text[] not null default '{}',
  visit_duration integer not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table shops enable row level security;
create policy "shops_public_read" on shops for select using (true);
create policy "shops_auth_write" on shops for all to authenticated using (true) with check (true);

-- ============================================
-- Shop ↔ Category (多對多)
-- ============================================
create table shop_categories (
  shop_id integer not null references shops(id) on delete cascade,
  category_id integer not null references categories(id) on delete cascade,
  primary key (shop_id, category_id)
);

alter table shop_categories enable row level security;
create policy "shop_categories_public_read" on shop_categories for select using (true);
create policy "shop_categories_auth_write" on shop_categories for all to authenticated using (true) with check (true);

-- ============================================
-- Lists (使用者自訂清單)
-- ============================================
create table lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default 'bg-rose-500',
  is_public boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table lists enable row level security;
create policy "lists_public_read" on lists for select using (is_public = true or auth.uid() = user_id);
create policy "lists_owner_insert" on lists for insert with check (auth.uid() = user_id);
create policy "lists_owner_update" on lists for update using (auth.uid() = user_id);
create policy "lists_owner_delete" on lists for delete using (auth.uid() = user_id);

-- ============================================
-- List Items
-- ============================================
create table list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references lists(id) on delete cascade,
  shop_id integer not null references shops(id) on delete cascade,
  note text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (list_id, shop_id)
);

alter table list_items enable row level security;
create policy "list_items_read" on list_items for select using (
  exists (select 1 from lists where lists.id = list_items.list_id and (lists.is_public = true or lists.user_id = auth.uid()))
);
create policy "list_items_owner_insert" on list_items for insert with check (
  exists (select 1 from lists where lists.id = list_items.list_id and lists.user_id = auth.uid())
);
create policy "list_items_owner_update" on list_items for update using (
  exists (select 1 from lists where lists.id = list_items.list_id and lists.user_id = auth.uid())
);
create policy "list_items_owner_delete" on list_items for delete using (
  exists (select 1 from lists where lists.id = list_items.list_id and lists.user_id = auth.uid())
);

-- ============================================
-- Auto-update updated_at
-- ============================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger shops_updated_at before update on shops
  for each row execute function update_updated_at();
create trigger lists_updated_at before update on lists
  for each row execute function update_updated_at();
