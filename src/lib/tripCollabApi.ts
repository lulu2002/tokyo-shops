import { supabase } from './supabase';
import type { TripMember, TripInvite, TripShopItem, TripRole } from '../types/trip';

// ============================================
// User Profiles
// ============================================

export async function upsertUserProfile(userId: string, displayName: string, avatarUrl: string) {
  await supabase.from('user_profiles').upsert({
    user_id: userId,
    display_name: displayName,
    avatar_url: avatarUrl,
  }, { onConflict: 'user_id' });
}

// ============================================
// Trip Members
// ============================================

export async function fetchTripMembers(tripId: string): Promise<TripMember[]> {
  const { data, error } = await supabase
    .from('trip_members')
    .select('*, user_profiles(display_name, avatar_url)')
    .eq('trip_id', tripId)
    .order('joined_at');
  if (error) throw error;
  return (data || []).map((row: Record<string, unknown>) => {
    const profile = row.user_profiles as { display_name?: string; avatar_url?: string } | null;
    return {
      id: row.id as string,
      tripId: row.trip_id as string,
      userId: row.user_id as string,
      role: row.role as TripRole,
      joinedAt: row.joined_at as string,
      displayName: profile?.display_name ?? undefined,
      avatarUrl: profile?.avatar_url ?? undefined,
    };
  });
}

export async function removeTripMember(tripId: string, userId: string) {
  const { error } = await supabase
    .from('trip_members')
    .delete()
    .eq('trip_id', tripId)
    .eq('user_id', userId);
  if (error) throw error;
}

// ============================================
// Trip Invites
// ============================================

export async function createTripInvite(tripId: string, role: 'editor' | 'viewer' = 'editor'): Promise<TripInvite> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('trip_invites')
    .insert({
      trip_id: tripId,
      created_by: session.user.id,
      role,
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    tripId: data.trip_id,
    createdBy: data.created_by,
    role: data.role,
    expiresAt: data.expires_at,
    createdAt: data.created_at,
  };
}

export async function fetchTripInvite(inviteId: string): Promise<TripInvite | null> {
  const { data, error } = await supabase
    .from('trip_invites')
    .select('*')
    .eq('id', inviteId)
    .single();
  if (error) return null;
  return {
    id: data.id,
    tripId: data.trip_id,
    createdBy: data.created_by,
    role: data.role,
    expiresAt: data.expires_at,
    createdAt: data.created_at,
  };
}

export async function joinTripViaInvite(inviteId: string): Promise<{ tripId: string; role: string; alreadyMember?: boolean } | { error: string }> {
  const { data, error } = await supabase.rpc('join_trip_via_invite', { invite_id: inviteId });
  if (error) throw error;
  if (data.error) return { error: data.error };
  return { tripId: data.trip_id, role: data.role, alreadyMember: data.already_member };
}

// ============================================
// Trip Shop Items
// ============================================

export async function fetchTripShopItems(tripId: string): Promise<TripShopItem[]> {
  const { data, error } = await supabase
    .from('trip_shop_items')
    .select('*')
    .eq('trip_id', tripId)
    .order('sort_order');
  if (error) throw error;
  return (data || []).map(mapShopItem);
}

export async function addTripShopItem(tripId: string, shopId: number, sortOrder: number): Promise<TripShopItem> {
  const { data: { session } } = await supabase.auth.getSession();
  const { data, error } = await supabase
    .from('trip_shop_items')
    .upsert({
      trip_id: tripId,
      shop_id: shopId,
      sort_order: sortOrder,
      added_by: session?.user.id ?? null,
    }, { onConflict: 'trip_id,shop_id' })
    .select()
    .single();
  if (error) throw error;
  return mapShopItem(data);
}

export async function removeTripShopItem(tripId: string, shopId: number) {
  const { error } = await supabase
    .from('trip_shop_items')
    .delete()
    .eq('trip_id', tripId)
    .eq('shop_id', shopId);
  if (error) throw error;
}

export async function updateTripShopItem(tripId: string, shopId: number, updates: {
  sortOrder?: number;
  visited?: boolean;
  durationOverride?: number | null;
}) {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder;
  if (updates.visited !== undefined) dbUpdates.visited = updates.visited;
  if (updates.durationOverride !== undefined) dbUpdates.duration_override = updates.durationOverride;

  const { error } = await supabase
    .from('trip_shop_items')
    .update(dbUpdates)
    .eq('trip_id', tripId)
    .eq('shop_id', shopId);
  if (error) throw error;
}

export async function batchUpdateSortOrder(tripId: string, items: { shopId: number; sortOrder: number }[]) {
  // Use Promise.all for parallel updates
  await Promise.all(
    items.map(item =>
      supabase
        .from('trip_shop_items')
        .update({ sort_order: item.sortOrder })
        .eq('trip_id', tripId)
        .eq('shop_id', item.shopId)
    )
  );
}

// ============================================
// Migration: shop_ids array → trip_shop_items
// ============================================

export async function migrateTrioToCollaborative(tripId: string) {
  const { data: trip, error } = await supabase
    .from('trips')
    .select('user_id, shop_ids, visited_ids, shop_durations')
    .eq('id', tripId)
    .single();
  if (error) throw error;

  const shopIds: number[] = trip.shop_ids || [];
  const visitedIds: number[] = trip.visited_ids || [];
  const shopDurations: Record<string, number> = trip.shop_durations || {};
  const visitedSet = new Set(visitedIds);

  // Insert shop items
  if (shopIds.length > 0) {
    const items = shopIds.map((shopId, idx) => ({
      trip_id: tripId,
      shop_id: shopId,
      sort_order: (idx + 1) * 1000,
      visited: visitedSet.has(shopId),
      duration_override: shopDurations[String(shopId)] ?? null,
      added_by: trip.user_id,
    }));
    await supabase.from('trip_shop_items').upsert(items, { onConflict: 'trip_id,shop_id' });
  }

  // Ensure owner is in trip_members
  await supabase.from('trip_members').upsert({
    trip_id: tripId,
    user_id: trip.user_id,
    role: 'owner',
  }, { onConflict: 'trip_id,user_id' });

  // Mark as collaborative
  await supabase.from('trips').update({ is_collaborative: true }).eq('id', tripId);
}

// ============================================
// Fetch single trip by ID (for join flow)
// ============================================

export async function fetchTripById(tripId: string) {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single();
  if (error) throw error;
  return data;
}

// ============================================
// Helpers
// ============================================

function mapShopItem(row: Record<string, unknown>): TripShopItem {
  return {
    id: row.id as string,
    tripId: row.trip_id as string,
    shopId: row.shop_id as number,
    sortOrder: row.sort_order as number,
    visited: row.visited as boolean,
    durationOverride: row.duration_override as number | null,
    addedBy: row.added_by as string | null,
    createdAt: row.created_at as string,
  };
}
