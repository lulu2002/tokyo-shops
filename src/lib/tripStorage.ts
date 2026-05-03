export interface SavedTrip {
  id: string;
  name: string;
  tripDate: string;       // "2025-05-10"
  startTime: string;      // "13:00" or ""
  endTime: string;        // "18:00" or ""
  shopIds: number[];      // ordered
  visitedIds: number[];   // shops marked as visited
  createdAt: string;
}

const STORAGE_KEY = 'tokyo-shops:trips';

function loadAll(): SavedTrip[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(trips: SavedTrip[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
}

export function listTrips(): SavedTrip[] {
  return loadAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function saveTrip(trip: Omit<SavedTrip, 'id' | 'createdAt'>): SavedTrip {
  const trips = loadAll();
  const saved: SavedTrip = {
    ...trip,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  trips.push(saved);
  saveAll(trips);
  return saved;
}

export function updateTrip(id: string, updates: Partial<SavedTrip>) {
  const trips = loadAll();
  const idx = trips.findIndex(t => t.id === id);
  if (idx >= 0) {
    trips[idx] = { ...trips[idx], ...updates };
    saveAll(trips);
  }
}

export function deleteTrip(id: string) {
  saveAll(loadAll().filter(t => t.id !== id));
}
