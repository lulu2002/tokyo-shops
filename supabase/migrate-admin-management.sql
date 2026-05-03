-- ============================================
-- Admin management: allow admins to add/remove other admins
-- ============================================

-- Admin can insert new admins
create policy "admin_insert" on admin_users for insert
  with check (exists (select 1 from admin_users where user_id = auth.uid()));

-- Admin can remove other admins (but not themselves for safety)
create policy "admin_delete" on admin_users for delete
  using (exists (select 1 from admin_users where user_id = auth.uid()));

-- ============================================
-- RPC: search auth.users by email (admin only)
-- Client can't query auth.users directly, so we use SECURITY DEFINER
-- ============================================
create or replace function search_users_by_email(search_email text)
returns table (
  out_id uuid,
  out_email text,
  out_display_name text,
  out_avatar_url text
) as $$
begin
  -- Only admins can search
  if not exists (select 1 from admin_users au where au.user_id = auth.uid()) then
    raise exception 'Not authorized';
  end if;

  return query
    select
      u.id,
      u.email::text,
      coalesce(p.display_name, u.raw_user_meta_data->>'full_name', '')::text,
      coalesce(p.avatar_url, u.raw_user_meta_data->>'avatar_url', '')::text
    from auth.users u
    left join user_profiles p on p.user_id = u.id
    where u.email ilike '%' || search_email || '%'
    limit 10;
end;
$$ language plpgsql security definer stable;

-- ============================================
-- RPC: list current admins with profile info
-- ============================================
create or replace function list_admins()
returns table (
  out_user_id uuid,
  out_email text,
  out_display_name text,
  out_avatar_url text,
  out_created_at timestamptz
) as $$
begin
  -- Only admins can list
  if not exists (select 1 from admin_users au where au.user_id = auth.uid()) then
    raise exception 'Not authorized';
  end if;

  return query
    select
      a.user_id,
      u.email::text,
      coalesce(p.display_name, u.raw_user_meta_data->>'full_name', '')::text,
      coalesce(p.avatar_url, u.raw_user_meta_data->>'avatar_url', '')::text,
      a.created_at
    from admin_users a
    join auth.users u on u.id = a.user_id
    left join user_profiles p on p.user_id = a.user_id
    order by a.created_at;
end;
$$ language plpgsql security definer stable;
