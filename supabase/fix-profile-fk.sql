-- Add FK from trip_members.user_id → user_profiles.user_id
-- so PostgREST can auto-join them
alter table trip_members
  add constraint trip_members_user_profile_fk
  foreign key (user_id) references user_profiles(user_id);
