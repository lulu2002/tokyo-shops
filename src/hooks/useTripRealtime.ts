import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  fetchTripShopItems,
  addTripShopItem,
  removeTripShopItem,
  updateTripShopItem,
  batchUpdateSortOrder,
} from '../lib/tripCollabApi';
import type { TripShopItem } from '../types/trip';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseTripRealtimeReturn {
  /** Shop items sorted by sort_order */
  shopItems: TripShopItem[];
  /** Ordered shop IDs (convenience) */
  shopIds: number[];
  /** Set of visited shop IDs */
  visitedIds: Set<number>;
  /** Map of shopId → duration override */
  shopDurations: Map<number, number>;
  /** Add a shop to the trip */
  addShop: (shopId: number) => Promise<void>;
  /** Remove a shop from the trip */
  removeShop: (shopId: number) => Promise<void>;
  /** Toggle visited status */
  toggleVisited: (shopId: number) => Promise<void>;
  /** Update duration override */
  updateDuration: (shopId: number, duration: number | null) => Promise<void>;
  /** Reorder all shops (provide new ordered shopId array) */
  reorder: (newOrder: number[]) => Promise<void>;
  /** Loading state */
  loading: boolean;
}

export function useTripRealtime(tripId: string | null, enabled: boolean): UseTripRealtimeReturn {
  const [shopItems, setShopItems] = useState<TripShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Fetch initial data
  useEffect(() => {
    if (!tripId || !enabled) {
      setShopItems([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchTripShopItems(tripId).then(items => {
      if (!cancelled) {
        setShopItems(items);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [tripId, enabled]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!tripId || !enabled) return;

    const channel = supabase
      .channel(`trip-items:${tripId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'trip_shop_items',
        filter: `trip_id=eq.${tripId}`,
      }, (payload) => {
        const row = payload.new as Record<string, unknown>;
        const item = mapRealtimeItem(row);
        setShopItems(prev => {
          // Don't add duplicates (optimistic update might have already added it)
          if (prev.some(i => i.shopId === item.shopId)) {
            return prev.map(i => i.shopId === item.shopId ? item : i);
          }
          return [...prev, item].sort((a, b) => a.sortOrder - b.sortOrder);
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'trip_shop_items',
        filter: `trip_id=eq.${tripId}`,
      }, (payload) => {
        const row = payload.new as Record<string, unknown>;
        const item = mapRealtimeItem(row);
        setShopItems(prev =>
          prev.map(i => i.shopId === item.shopId ? item : i).sort((a, b) => a.sortOrder - b.sortOrder)
        );
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'trip_shop_items',
        filter: `trip_id=eq.${tripId}`,
      }, (payload) => {
        const oldRow = payload.old as Record<string, unknown>;
        const shopId = oldRow.shop_id as number;
        setShopItems(prev => prev.filter(i => i.shopId !== shopId));
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [tripId, enabled]);

  // Derived values
  const shopIds = shopItems.map(i => i.shopId);
  const visitedIds = new Set(shopItems.filter(i => i.visited).map(i => i.shopId));
  const shopDurations = new Map(
    shopItems
      .filter(i => i.durationOverride !== null)
      .map(i => [i.shopId, i.durationOverride!])
  );

  const addShop = useCallback(async (shopId: number) => {
    if (!tripId) return;
    // Optimistic: add with next sort order
    const maxOrder = shopItems.length > 0
      ? Math.max(...shopItems.map(i => i.sortOrder))
      : 0;
    const newOrder = maxOrder + 1000;

    setShopItems(prev => {
      if (prev.some(i => i.shopId === shopId)) return prev;
      return [...prev, {
        id: `temp-${shopId}`,
        tripId,
        shopId,
        sortOrder: newOrder,
        visited: false,
        durationOverride: null,
        addedBy: null,
        createdAt: new Date().toISOString(),
      }];
    });

    await addTripShopItem(tripId, shopId, newOrder);
  }, [tripId, shopItems]);

  const removeShop = useCallback(async (shopId: number) => {
    if (!tripId) return;
    // Optimistic
    setShopItems(prev => prev.filter(i => i.shopId !== shopId));
    await removeTripShopItem(tripId, shopId);
  }, [tripId]);

  const toggleVisited = useCallback(async (shopId: number) => {
    if (!tripId) return;
    const item = shopItems.find(i => i.shopId === shopId);
    if (!item) return;
    const newVisited = !item.visited;
    // Optimistic
    setShopItems(prev => prev.map(i => i.shopId === shopId ? { ...i, visited: newVisited } : i));
    await updateTripShopItem(tripId, shopId, { visited: newVisited });
  }, [tripId, shopItems]);

  const updateDuration = useCallback(async (shopId: number, duration: number | null) => {
    if (!tripId) return;
    // Optimistic
    setShopItems(prev => prev.map(i => i.shopId === shopId ? { ...i, durationOverride: duration } : i));
    await updateTripShopItem(tripId, shopId, { durationOverride: duration });
  }, [tripId]);

  const reorder = useCallback(async (newOrder: number[]) => {
    if (!tripId) return;
    // Optimistic: update sort_order based on position
    const updates = newOrder.map((shopId, idx) => ({
      shopId,
      sortOrder: (idx + 1) * 1000,
    }));

    setShopItems(prev => {
      const map = new Map(prev.map(i => [i.shopId, i]));
      return updates
        .map(u => {
          const item = map.get(u.shopId);
          return item ? { ...item, sortOrder: u.sortOrder } : null;
        })
        .filter((i): i is TripShopItem => i !== null);
    });

    await batchUpdateSortOrder(tripId, updates);
  }, [tripId]);

  return {
    shopItems,
    shopIds,
    visitedIds,
    shopDurations,
    addShop,
    removeShop,
    toggleVisited,
    updateDuration,
    reorder,
    loading,
  };
}

function mapRealtimeItem(row: Record<string, unknown>): TripShopItem {
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
