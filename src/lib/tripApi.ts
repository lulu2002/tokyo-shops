import { supabase } from './supabase';

export interface DbTrip {
  id: string;
  user_id: string;
  name: string;
  trip_date: string;
  start_time: string | null;
  end_time: string | null;
  shop_ids: number[];
  visited_ids: number[];
  shop_durations: Record<string, number>;
  ai_notes: Record<string, string>;
  is_collaborative: boolean;
  created_at: string;
  updated_at: string;
}

export interface Trip {
  id: string;
  userId: string;
  name: string;
  tripDate: string;
  startTime: string;
  endTime: string;
  shopIds: number[];
  visitedIds: number[];
  shopDurations: Record<string, number>;
  aiNotes: Record<string, string>;
  isCollaborative: boolean;
  createdAt: string;
}

function mapTrip(db: DbTrip): Trip {
  return {
    id: db.id,
    userId: db.user_id,
    name: db.name,
    tripDate: db.trip_date,
    startTime: db.start_time || '',
    endTime: db.end_time || '',
    shopIds: db.shop_ids || [],
    visitedIds: db.visited_ids || [],
    shopDurations: db.shop_durations || {},
    aiNotes: db.ai_notes || {},
    isCollaborative: db.is_collaborative ?? false,
    createdAt: db.created_at,
  };
}

export async function fetchMyTrips(userId: string): Promise<Trip[]> {
  // Fetch owned trips + trips where user is a member
  const [owned, memberOf] = await Promise.all([
    supabase
      .from('trips')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('trip_members')
      .select('trip_id')
      .eq('user_id', userId),
  ]);
  if (owned.error) throw owned.error;

  const ownedTrips = (owned.data || []).map(mapTrip);
  const ownedIds = new Set(ownedTrips.map(t => t.id));

  // Fetch member trips not already in owned
  if (memberOf.data && memberOf.data.length > 0) {
    const memberTripIds = memberOf.data
      .map(m => m.trip_id as string)
      .filter(id => !ownedIds.has(id));

    if (memberTripIds.length > 0) {
      const { data: memberTrips } = await supabase
        .from('trips')
        .select('*')
        .in('id', memberTripIds)
        .order('created_at', { ascending: false });
      if (memberTrips) {
        return [...ownedTrips, ...memberTrips.map(mapTrip)];
      }
    }
  }

  return ownedTrips;
}

export async function createTrip(userId: string, trip: {
  name: string;
  tripDate: string;
  startTime: string;
  endTime: string;
  shopIds: number[];
  visitedIds: number[];
  shopDurations: Record<string, number>;
}): Promise<Trip> {
  const { data, error } = await supabase
    .from('trips')
    .insert({
      user_id: userId,
      name: trip.name,
      trip_date: trip.tripDate,
      start_time: trip.startTime || null,
      end_time: trip.endTime || null,
      shop_ids: trip.shopIds,
      visited_ids: trip.visitedIds,
      shop_durations: trip.shopDurations,
    })
    .select()
    .single();
  if (error) throw error;
  return mapTrip(data);
}

export async function updateTripDb(tripId: string, updates: Partial<{
  name: string;
  tripDate: string;
  startTime: string;
  endTime: string;
  shopIds: number[];
  visitedIds: number[];
  shopDurations: Record<string, number>;
  aiNotes: Record<string, string>;
}>): Promise<void> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.tripDate !== undefined) dbUpdates.trip_date = updates.tripDate;
  if (updates.startTime !== undefined) dbUpdates.start_time = updates.startTime || null;
  if (updates.endTime !== undefined) dbUpdates.end_time = updates.endTime || null;
  if (updates.shopIds !== undefined) dbUpdates.shop_ids = updates.shopIds;
  if (updates.visitedIds !== undefined) dbUpdates.visited_ids = updates.visitedIds;
  if (updates.shopDurations !== undefined) dbUpdates.shop_durations = updates.shopDurations;
  if (updates.aiNotes !== undefined) dbUpdates.ai_notes = updates.aiNotes;

  const { error } = await supabase.from('trips').update(dbUpdates).eq('id', tripId);
  if (error) throw error;
}

export async function deleteTripDb(tripId: string): Promise<void> {
  const { error } = await supabase.from('trips').delete().eq('id', tripId);
  if (error) throw error;
}
