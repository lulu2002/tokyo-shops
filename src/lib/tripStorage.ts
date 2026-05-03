import { fetchMyTrips, createTrip, updateTripDb, deleteTripDb, type Trip } from './tripApi';
import { supabase } from './supabase';

// Unified trip interface used by components
export interface SavedTrip {
  id: string;
  name: string;
  tripDate: string;
  startTime: string;
  endTime: string;
  shopIds: number[];
  visitedIds: number[];
  shopDurations: Record<string, number>;
  createdAt: string;
}

function tripToSaved(t: Trip): SavedTrip {
  return {
    id: t.id,
    name: t.name,
    tripDate: t.tripDate,
    startTime: t.startTime,
    endTime: t.endTime,
    shopIds: t.shopIds,
    visitedIds: t.visitedIds,
    shopDurations: t.shopDurations,
    createdAt: t.createdAt,
  };
}

// ============================================
// localStorage fallback (for non-logged-in users)
// ============================================
const STORAGE_KEY = 'tokyo-shops:trips';

function loadLocal(): SavedTrip[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocal(trips: SavedTrip[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
}

// ============================================
// Public API — facade
// ============================================

async function getUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export async function listTripsAsync(): Promise<SavedTrip[]> {
  const userId = await getUserId();
  if (userId) {
    const trips = await fetchMyTrips(userId);
    return trips.map(tripToSaved);
  }
  return loadLocal().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveTripAsync(trip: Omit<SavedTrip, 'id' | 'createdAt'>): Promise<SavedTrip> {
  const userId = await getUserId();
  if (userId) {
    const created = await createTrip(userId, trip);
    return tripToSaved(created);
  }
  // localStorage fallback
  const saved: SavedTrip = {
    ...trip,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const trips = loadLocal();
  trips.push(saved);
  saveLocal(trips);
  return saved;
}

export async function updateTripAsync(id: string, updates: Partial<SavedTrip>): Promise<void> {
  const userId = await getUserId();
  if (userId) {
    await updateTripDb(id, updates);
    return;
  }
  // localStorage fallback
  const trips = loadLocal();
  const idx = trips.findIndex(t => t.id === id);
  if (idx >= 0) {
    trips[idx] = { ...trips[idx], ...updates };
    saveLocal(trips);
  }
}

export async function deleteTripAsync(id: string): Promise<void> {
  const userId = await getUserId();
  if (userId) {
    await deleteTripDb(id);
    return;
  }
  saveLocal(loadLocal().filter(t => t.id !== id));
}

// Sync: migrate localStorage trips to Supabase on login
export async function migrateLocalTrips(): Promise<number> {
  const userId = await getUserId();
  if (!userId) return 0;

  const local = loadLocal();
  if (local.length === 0) return 0;

  let migrated = 0;
  for (const trip of local) {
    try {
      await createTrip(userId, trip);
      migrated++;
    } catch {
      // skip duplicates or errors
    }
  }

  if (migrated > 0) {
    localStorage.removeItem(STORAGE_KEY);
  }
  return migrated;
}

// Synchronous versions for backward compatibility (used in non-async contexts)
// These only work with localStorage
export function listTrips(): SavedTrip[] {
  return loadLocal().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function deleteTrip(id: string) {
  saveLocal(loadLocal().filter(t => t.id !== id));
}
