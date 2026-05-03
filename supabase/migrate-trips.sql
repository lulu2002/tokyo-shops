create table trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  trip_date date not null,
  start_time text,
  end_time text,
  shop_ids integer[] not null default '{}',
  visited_ids integer[] not null default '{}',
  shop_durations jsonb not null default '{}',
  ai_notes jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table trips enable row level security;

create policy "trips_owner_select" on trips for select using (auth.uid() = user_id);
create policy "trips_owner_insert" on trips for insert with check (auth.uid() = user_id);
create policy "trips_owner_update" on trips for update using (auth.uid() = user_id);
create policy "trips_owner_delete" on trips for delete using (auth.uid() = user_id);

-- Auto-update updated_at
create trigger trips_updated_at
  before update on trips
  for each row execute function update_updated_at();
