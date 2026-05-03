import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APIProvider, Map as GoogleMap, AdvancedMarker, InfoWindow, useMap } from '@vis.gl/react-google-maps';
import type { Shop } from '../types/shop';
import type { TripStop } from '../types/trip';
import { getOpenWindow } from '../utils/openWindow';
import { clusterStops, interClusterWalkMinutes } from '../utils/clustering';
import { toJST } from '../utils/openStatus';
import { TripStopList } from './TripStopList';
import type { RouteSuggestion } from './TripSuggestion';
import { supabase } from '../lib/supabase';
import { saveTrip, updateTrip, type SavedTrip } from '../lib/tripStorage';
import { useTimeline } from '../hooks/useTimeline';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

interface CategoryInfo {
  id: number;
  name: string;
  label: string;
  color: string;
}

interface Props {
  shops: Shop[];
  categories: CategoryInfo[];
  onClose: () => void;
  loadTrip?: SavedTrip;
  inline?: boolean; // true = render as normal content (mobile), false = fixed overlay (desktop)
}

function TripMapInner({ shops, tripDate, onAddShop, onRemoveShop, selectedShopIds, editMode, orderedStops }: {
  shops: Shop[];
  tripDate: Date;
  onAddShop: (shop: Shop) => void;
  onRemoveShop: (shopId: number) => void;
  selectedShopIds: Set<number>;
  editMode: boolean;
  orderedStops: Shop[]; // selected shops in order, for route line
}) {
  const map = useMap();
  const [activeShop, setActiveShop] = useState<Shop | null>(null);

  // In view mode: fit bounds to selected shops
  useEffect(() => {
    if (!map) return;
    if (!editMode && orderedStops.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      for (const s of orderedStops) {
        if (s.lat && s.lng) bounds.extend({ lat: s.lat, lng: s.lng });
      }
      map.fitBounds(bounds, { top: 60, bottom: 40, left: 40, right: 40 });
    } else if (orderedStops.length === 0) {
      map.setCenter({ lat: 35.6762, lng: 139.6503 });
      map.setZoom(12);
    }
  }, [map, editMode, orderedStops]);

  // Draw route polyline
  useEffect(() => {
    if (!map) return;
    const path = orderedStops
      .filter(s => s.lat && s.lng)
      .map(s => ({ lat: s.lat, lng: s.lng }));

    if (path.length < 2) return;

    const polyline = new google.maps.Polyline({
      path,
      strokeColor: '#2563eb',
      strokeOpacity: 0.6,
      strokeWeight: 3,
      geodesic: true,
      map,
    });

    return () => { polyline.setMap(null); };
  }, [map, orderedStops]);

  // Which shops to show on map
  const visibleShops = editMode ? shops : shops.filter(s => selectedShopIds.has(s.id));

  return (
    <>
      <GoogleMap
        defaultCenter={{ lat: 35.6762, lng: 139.6503 }}
        defaultZoom={12}
        mapId="trip-planner-map"
        gestureHandling="greedy"
        disableDefaultUI={false}
        zoomControl={true}
        streetViewControl={false}
        fullscreenControl={false}
        mapTypeControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        {visibleShops.map((shop, _idx) => {
          if (!shop.lat || !shop.lng) return null;
          const isSelected = selectedShopIds.has(shop.id);
          const openResult = getOpenWindow(shop.hours, tripDate);
          const isClosed = openResult?.closed === true;

          // In view mode, show order number
          const orderIndex = !editMode ? orderedStops.findIndex(s => s.id === shop.id) : -1;

          return (
            <AdvancedMarker
              key={shop.id}
              position={{ lat: shop.lat, lng: shop.lng }}
              onClick={() => setActiveShop(shop)}
              zIndex={isSelected ? 10 : 1}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  backgroundColor: isSelected ? '#2563eb' : isClosed ? '#f3f4f6' : 'white',
                  border: `2px solid ${isSelected ? '#2563eb' : isClosed ? '#d1d5db' : '#9ca3af'}`,
                  borderRadius: 20, padding: '3px 8px 3px 4px',
                  boxShadow: isSelected ? '0 2px 8px rgba(37,99,235,0.3)' : '0 1px 3px rgba(0,0,0,0.15)',
                  whiteSpace: 'nowrap', opacity: isClosed && !isSelected ? 0.5 : 1,
                }}>
                  {isSelected && !editMode && orderIndex >= 0 ? (
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%',
                      backgroundColor: 'white', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, color: '#2563eb',
                    }}>
                      {orderIndex + 1}
                    </div>
                  ) : isSelected ? (
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      backgroundColor: 'white', flexShrink: 0,
                    }} />
                  ) : null}
                  <span style={{
                    fontSize: 11, fontWeight: 600, lineHeight: 1,
                    color: isSelected ? 'white' : isClosed ? '#9ca3af' : '#374151',
                    maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis',
                    textDecoration: isClosed ? 'line-through' : 'none',
                  }}>
                    {shop.name}
                  </span>
                </div>
                <div style={{
                  width: 0, height: 0,
                  borderLeft: '5px solid transparent',
                  borderRight: '5px solid transparent',
                  borderTop: `5px solid ${isSelected ? '#2563eb' : isClosed ? '#f3f4f6' : 'white'}`,
                  marginTop: -1,
                }} />
              </div>
            </AdvancedMarker>
          );
        })}

        {activeShop && activeShop.lat && activeShop.lng && (
          <InfoWindow
            position={{ lat: activeShop.lat, lng: activeShop.lng }}
            onCloseClick={() => setActiveShop(null)}
            pixelOffset={[0, -16]}
          >
            <div style={{ minWidth: 200, maxWidth: 280 }}>
              {activeShop.photoUrl && (
                <img src={activeShop.photoUrl} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 6, marginBottom: 8 }} />
              )}
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{activeShop.name}</div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 3 }}>
                {activeShop.subcategory}{activeShop.specialty ? ' · ' + activeShop.specialty : ''}
              </div>
              {(() => {
                const result = getOpenWindow(activeShop.hours, tripDate);
                if (result === null) return <div style={{ fontSize: 12, color: '#999' }}>營業時間不明</div>;
                if (result.closed) return <div style={{ fontSize: 12, color: '#ef4444' }}>當天公休</div>;
                return <div style={{ fontSize: 12, color: '#22c55e' }}>{result.window.openStr}～{result.window.closeStr}</div>;
              })()}

              <button
                onClick={() => {
                  if (selectedShopIds.has(activeShop.id)) {
                    onRemoveShop(activeShop.id);
                  } else {
                    onAddShop(activeShop);
                  }
                  setActiveShop(null);
                }}
                style={{
                  width: '100%', marginTop: 8, padding: '8px 0', borderRadius: 8,
                  backgroundColor: selectedShopIds.has(activeShop.id) ? '#fee2e2' : '#2563eb',
                  color: selectedShopIds.has(activeShop.id) ? '#ef4444' : 'white',
                  fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer',
                }}
              >
                {selectedShopIds.has(activeShop.id) ? '移除' : '+ 想去'}
              </button>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </>
  );
}

export function TripPlanner({ shops, categories, onClose, loadTrip, inline }: Props) {
  // Filter state
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Filtered shops for map display
  const displayShops = useMemo(() => {
    let result = shops;
    if (filterCategory) {
      result = result.filter(s => s.categories.includes(filterCategory));
    }
    if (searchText) {
      const q = searchText.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.subcategory.toLowerCase().includes(q) ||
        (s.specialty && s.specialty.toLowerCase().includes(q))
      );
    }
    return result;
  }, [shops, filterCategory, searchText]);

  // Trip state
  const [savedId, setSavedId] = useState<string | null>(loadTrip?.id ?? null);
  const [tripDate, setTripDate] = useState(() => {
    if (loadTrip) return loadTrip.tripDate;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [startTime, setStartTime] = useState<string>(loadTrip?.startTime ?? '');
  const [endTime, setEndTime] = useState<string>(loadTrip?.endTime ?? '');
  const [orderedShopIds, setOrderedShopIds] = useState<number[]>(loadTrip?.shopIds ?? []);
  const [visitedIds, setVisitedIds] = useState<Set<number>>(new Set(loadTrip?.visitedIds ?? []));
  const [trayOpen, setTrayOpen] = useState(!!loadTrip); // open tray by default when loading a saved trip
  const [sidebarWidth, setSidebarWidth] = useState(420);
  const resizingRef = useRef(false);
  const [suggesting, setSuggesting] = useState(false);
  const [aiNotes, setAiNotes] = useState<Map<number, string>>(new Map()); // shopId → AI note
  const [aiSummary, setAiSummary] = useState<string>('');
  const [extraInput, setExtraInput] = useState<string>('');
  const [shopDurations, setShopDurations] = useState<Map<number, number>>(new Map());
  const [editMode, setEditMode] = useState(!loadTrip); // new trips start in edit mode

  // Ordered shops for route drawing
  const orderedStops = useMemo(() => {
    return orderedShopIds
      .map(id => shops.find(s => s.id === id))
      .filter((s): s is Shop => s !== null && s !== undefined && !!s.lat && !!s.lng);
  }, [orderedShopIds, shops]);

  // Derived: selectedShopIds as Set for quick lookup
  const selectedShopIds = useMemo(() => new Set(orderedShopIds), [orderedShopIds]);

  // Computed JST date for the trip
  const tripDateJST = useMemo(() => {
    const d = new Date(tripDate + 'T12:00:00+09:00');
    return toJST(d);
  }, [tripDate]);

  // Day of week label
  const dayLabel = useMemo(() => {
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    return days[tripDateJST.getDay()];
  }, [tripDateJST]);

  // Build trip stops with open window info (preserve order)
  const stops = useMemo((): TripStop[] => {
    return orderedShopIds.map(id => {
      const shop = shops.find(s => s.id === id);
      if (!shop) return null;

      const result = getOpenWindow(shop.hours, tripDateJST);
      return {
        shop,
        openWindow: result?.closed === false ? result.window : null,
        closed: result?.closed === true,
        visited: visitedIds.has(id),
      };
    }).filter((s): s is TripStop => s !== null);
  }, [orderedShopIds, shops, tripDateJST, visitedIds]);

  // Split into active and closed
  const activeStops = useMemo(() => stops.filter(s => !s.closed), [stops]);
  const closedStops = useMemo(() => stops.filter(s => s.closed), [stops]);

  // Cluster active stops
  const clusters = useMemo(() => clusterStops(activeStops), [activeStops]);

  // Timeline calculation
  const hasTimeWindow = startTime !== '' && endTime !== '';
  const timeline = useTimeline(clusters, startTime, shopDurations);

  // Feasibility (only when time window is set)
  const feasibility = useMemo(() => {
    if (!hasTimeWindow) return undefined;

    const startMin = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1] || '0');
    const endMin = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1] || '0');
    const available = endMin - startMin;

    // Use actual durations from shopDurations map
    let shopTime = 0;
    for (const stop of activeStops) {
      shopTime += shopDurations.get(stop.shop.id) ?? stop.shop.visitDuration ?? 20;
    }
    let walkTime = 0;
    for (let i = 0; i < clusters.length - 1; i++) {
      walkTime += interClusterWalkMinutes(clusters[i], clusters[i + 1]);
    }
    const needed = shopTime + walkTime;

    return { needed, available, ratio: available > 0 ? needed / available : 0 };
  }, [hasTimeWindow, startTime, endTime, activeStops, clusters, shopDurations]);

  // Handle duration change
  const handleDurationChange = useCallback((shopId: number, duration: number) => {
    setShopDurations(prev => {
      const next = new Map(prev);
      // Find shop's default duration
      const shop = shops.find(s => s.id === shopId);
      const defaultDur = shop?.visitDuration ?? 20;
      if (duration === defaultDur) next.delete(shopId); // back to default, remove override
      else next.set(shopId, duration);
      return next;
    });
  }, [shops]);

  const [lastAdded, setLastAdded] = useState<string | null>(null);

  const handleAddShop = useCallback((shop: Shop) => {
    setOrderedShopIds(prev => prev.includes(shop.id) ? prev : [...prev, shop.id]);
    setLastAdded(shop.name);
    setTimeout(() => setLastAdded(null), 1500);
  }, []);

  const handleRemoveShop = useCallback((shopId: number) => {
    setOrderedShopIds(prev => prev.filter(id => id !== shopId));
  }, []);

  // Toggle visited
  const handleToggleVisited = useCallback((shopId: number) => {
    setVisitedIds(prev => {
      const next = new Set(prev);
      if (next.has(shopId)) next.delete(shopId);
      else next.add(shopId);
      // Auto-save if trip is saved
      if (savedId) {
        updateTrip(savedId, { visitedIds: [...next] });
      }
      return next;
    });
  }, [savedId]);

  // Reorder clusters (swap entire cluster groups in orderedShopIds)
  const handleReorderClusters = useCallback((fromIdx: number, toIdx: number) => {
    // Rebuild orderedShopIds with clusters in new order
    const reordered = [...clusters];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    const newOrder: number[] = [];
    for (const cluster of reordered) {
      for (const stop of cluster.stops) newOrder.push(stop.shop.id);
    }
    // Add closed/unknown shops at the end
    for (const id of orderedShopIds) {
      if (!newOrder.includes(id)) newOrder.push(id);
    }
    setOrderedShopIds(newOrder);
  }, [clusters, orderedShopIds]);

  // Reorder shop within a cluster
  const handleReorderShopInCluster = useCallback((clusterIdx: number, fromIdx: number, toIdx: number) => {
    const cluster = clusters[clusterIdx];
    if (!cluster) return;
    const shopIds = cluster.stops.map(s => s.shop.id);
    const [moved] = shopIds.splice(fromIdx, 1);
    shopIds.splice(toIdx, 0, moved);

    // Rebuild full order: replace this cluster's segment
    const newOrder = [...orderedShopIds];
    const clusterIdSet = new Set(cluster.stops.map(s => s.shop.id));
    const filtered = newOrder.filter(id => !clusterIdSet.has(id));

    // Find where to insert (position of first shop of this cluster in original order)
    const firstOrigIdx = newOrder.findIndex(id => clusterIdSet.has(id));
    filtered.splice(firstOrigIdx, 0, ...shopIds);
    setOrderedShopIds(filtered);
  }, [clusters, orderedShopIds]);

  // Save trip
  const handleSave = useCallback(() => {
    if (savedId) {
      updateTrip(savedId, {
        tripDate,
        startTime,
        endTime,
        shopIds: orderedShopIds,
        visitedIds: [...visitedIds],
      });
    } else {
      const days = ['日', '一', '二', '三', '四', '五', '六'];
      const d = tripDateJST;
      const name = `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]}) 行程`;
      const saved = saveTrip({
        name,
        tripDate,
        startTime,
        endTime,
        shopIds: orderedShopIds,
        visitedIds: [...visitedIds],
      });
      setSavedId(saved.id);
    }
  }, [savedId, tripDate, startTime, endTime, orderedShopIds, visitedIds, tripDateJST]);

  // Request AI suggestion → directly reorder list + annotate
  const handleSuggest = useCallback(async () => {
    if (!hasTimeWindow || activeStops.length === 0) return;
    setSuggesting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('請先登入');

      const days = ['日', '一', '二', '三', '四', '五', '六'];

      const payload = {
        tripDate: tripDate,
        dayOfWeek: days[tripDateJST.getDay()],
        startTime,
        endTime,
        shops: stops.map(s => ({
          id: s.shop.id,
          name: s.shop.name,
          lat: s.shop.lat,
          lng: s.shop.lng,
          subcategory: s.shop.subcategory,
          specialty: s.shop.specialty,
          rating: s.shop.rating || 0,
          openWindow: s.openWindow ? { open: s.openWindow.openStr, close: s.openWindow.closeStr } : null,
          closed: s.closed,
          duration: shopDurations.get(s.shop.id) ?? s.shop.visitDuration ?? 20,
        })),
        clusters: clusters.map(c => ({
          name: c.name,
          shopIds: c.stops.map(s => s.shop.id),
        })),
        interClusterWalk: clusters.slice(0, -1).map((c, i) => ({
          from: c.name,
          to: clusters[i + 1].name,
          minutes: interClusterWalkMinutes(c, clusters[i + 1]),
        })),
        extraConstraints: extraInput || undefined,
      };

      const res = await fetch(`${SUPABASE_URL}/functions/v1/suggest-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('建議路線失敗');
      const data = await res.json() as RouteSuggestion;

      // Directly reorder the list based on AI suggestion
      const newOrder: number[] = [];
      const notes = new Map<number, string>();

      for (const cluster of data.suggestedOrder) {
        for (const shop of cluster.shops) {
          const id = typeof shop.id === 'number' ? shop.id : Number(shop.id);
          if (!isNaN(id) && selectedShopIds.has(id)) {
            newOrder.push(id);
            if (shop.note) notes.set(id, shop.note);
            if (shop.priority === 'high' && !shop.note) notes.set(id, '優先');
          }
        }
      }
      // Warnings
      for (const w of (data.warnings || [])) {
        const id = typeof w.shopId === 'number' ? w.shopId : Number(w.shopId);
        if (!isNaN(id)) notes.set(id, w.message);
      }
      // Add remaining shops not in suggestion
      for (const id of orderedShopIds) {
        if (!newOrder.includes(id)) newOrder.push(id);
      }

      setOrderedShopIds(newOrder);
      setAiNotes(notes);
      setAiSummary(data.summary || '');
          } catch (err) {
      console.error('Suggest failed:', err);
      alert('建議路線失敗: ' + (err instanceof Error ? err.message : '未知錯誤'));
    } finally {
      setSuggesting(false);
    }
  }, [hasTimeWindow, activeStops.length, stops, clusters, tripDate, tripDateJST, startTime, endTime, selectedShopIds, orderedShopIds]);

  // ESC to close + lock body scroll (only for overlay mode, not inline)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    if (!inline) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (!inline) {
        document.body.style.overflow = '';
      }
    };
  }, [onClose, inline]);

  return (
    <div className={inline
      ? 'flex flex-col bg-white'
      : 'fixed inset-0 bottom-0 z-40 bg-white flex flex-col'
    } style={inline ? { height: 'calc(100vh - 56px)' } : undefined}>
      {/* Setup bar */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 flex-wrap">
        {editMode ? (
          <>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">日期</label>
              <input
                type="date"
                value={tripDate}
                onChange={e => setTripDate(e.target.value)}
                className="px-2 py-1 text-sm border border-gray-200 rounded-lg"
              />
              <span className="text-xs text-gray-400">(週{dayLabel})</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">時間</label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="px-2 py-1 text-sm border border-gray-200 rounded-lg w-24"
              />
              <span className="text-gray-300">～</span>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="px-2 py-1 text-sm border border-gray-200 rounded-lg w-24"
              />
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <span className="font-medium">{tripDate}</span>
            <span className="text-gray-400">(週{dayLabel})</span>
            {startTime && endTime && <span className="text-gray-400">{startTime}～{endTime}</span>}
            <span className="text-gray-400">·</span>
            <span>{orderedShopIds.length} 間店</span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setEditMode(v => !v)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              editMode
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {editMode ? '完成編輯' : '編輯行程'}
          </button>
          <button
            onClick={onClose}
            className="px-2 py-1.5 text-sm text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main area: map + list */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Map + filters */}
        <div className={`flex-1 relative flex flex-col ${trayOpen ? 'hidden sm:flex' : ''}`}>
          {/* Filter bar — edit mode only */}
          <div className="shrink-0 bg-white border-b border-gray-200 px-2 py-1.5 flex items-center gap-2" style={{ display: editMode ? '' : 'none' }}>
            {/* Search */}
            <input
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="搜尋店名..."
              className="px-2 py-1 text-xs border border-gray-200 rounded-md w-28 sm:w-36 focus:outline-none focus:ring-1 focus:ring-blue-300"
            />

            {/* Category toggle */}
            <button
              onClick={() => setFilterOpen(v => !v)}
              className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                filterCategory ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {filterCategory || '分類篩選'}
              {filterCategory && ' ✕'}
            </button>

            {/* Selected count */}
            <span className="text-xs text-gray-400 ml-auto">{displayShops.length} 間</span>
          </div>

          {/* Category chips (collapsible) */}
          {editMode && filterOpen && (
            <div className="shrink-0 bg-white border-b border-gray-100 px-2 py-1.5 flex flex-wrap gap-1">
              <button
                onClick={() => { setFilterCategory(null); setFilterOpen(false); }}
                className={`text-xs px-2 py-1 rounded-full ${!filterCategory ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                全部
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => { setFilterCategory(cat.name); setFilterOpen(false); }}
                  className={`text-xs px-2 py-1 rounded-full ${
                    filterCategory === cat.name ? `${cat.color} text-white` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}

          {/* Map */}
          <div className="flex-1 relative">
            <APIProvider apiKey={API_KEY}>
              <TripMapInner
                shops={displayShops}
                tripDate={tripDateJST}
                onAddShop={handleAddShop}
                onRemoveShop={handleRemoveShop}
                selectedShopIds={selectedShopIds}
                editMode={editMode}
                orderedStops={orderedStops}
              />
            </APIProvider>
          </div>
        </div>

        {/* Side panel (desktop) / Bottom tray (mobile) */}
        <div
          className={`
            ${(editMode ? trayOpen : trayOpen) ? 'flex' : 'hidden sm:flex'}
            flex-col bg-white border-l border-gray-200
            w-full sm:shrink-0
            absolute sm:relative inset-0 sm:inset-auto z-10
          `}
          style={{ maxWidth: '100%', width: typeof window !== 'undefined' && window.innerWidth >= 640 ? sidebarWidth : undefined }}
        >
          {/* Resize handle (desktop only) */}
          <div
            className="hidden sm:block absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-500 z-20"
            onMouseDown={(e) => {
              e.preventDefault();
              resizingRef.current = true;
              const startX = e.clientX;
              const startW = sidebarWidth;
              const onMove = (ev: MouseEvent) => {
                if (!resizingRef.current) return;
                const newW = startW - (ev.clientX - startX);
                setSidebarWidth(Math.max(300, Math.min(800, newW)));
              };
              const onUp = () => {
                resizingRef.current = false;
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
              };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
          />
          {/* Tray header */}
          <div className="shrink-0 px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              已選 {stops.length} 間
              {closedStops.length > 0 && (
                <span className="text-red-400 ml-1">({closedStops.length} 間公休)</span>
              )}
            </span>
            <button
              onClick={() => setTrayOpen(false)}
              className="sm:hidden text-sm text-gray-400 hover:text-gray-600"
            >
              地圖 →
            </button>
          </div>

          {/* AI summary banner */}
          {aiSummary && (
            <div className="shrink-0 px-3 py-2 bg-indigo-50 border-b border-indigo-100 flex items-start gap-2">
              <span className="text-xs text-indigo-600 flex-1">{aiSummary}</span>
              <button onClick={() => { setAiSummary(''); setAiNotes(new Map()); }} className="text-xs text-indigo-400 shrink-0">✕</button>
            </div>
          )}

          <TripStopList
            clusters={clusters}
            closedStops={closedStops}
            onRemove={editMode ? handleRemoveShop : undefined}
            onToggleVisited={handleToggleVisited}
            onReorderClusters={editMode ? handleReorderClusters : undefined}
            onReorderShopInCluster={editMode ? handleReorderShopInCluster : undefined}
            onDurationChange={editMode ? handleDurationChange : undefined}
            aiNotes={aiNotes}
            shopDurations={shopDurations}
            timeline={timeline}
            totalStops={stops.length}
            hasTimeWindow={hasTimeWindow}
            feasibility={feasibility}
          />

          {/* Bottom actions */}
          <div className="shrink-0 p-3 border-t border-gray-100 flex flex-col gap-2">
            {editMode && (
              <>
                {/* Extra input for AI */}
                {hasTimeWindow && activeStops.length >= 2 && (
                  <textarea
                    value={extraInput}
                    onChange={e => setExtraInput(e.target.value)}
                    placeholder="額外需求（選填）：例如「中午想吃拉麵」「某間店一定要去」..."
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  />
                )}

                {/* Suggest button */}
                {hasTimeWindow && activeStops.length >= 2 && (
                  <button
                    onClick={handleSuggest}
                    disabled={suggesting}
                    className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium
                      hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-wait transition-colors"
                  >
                    {suggesting ? 'AI 分析中...' : aiSummary ? '重新建議路線' : '建議路線'}
                  </button>
                )}

                {/* Save button */}
                {stops.length > 0 && (
                  <button
                    onClick={handleSave}
                    className="w-full py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium
                      hover:bg-gray-800 transition-colors"
                  >
                    {savedId ? '更新行程' : '儲存行程'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Mobile: toast when shop added */}
        {lastAdded && !trayOpen && (
          <div className="sm:hidden absolute top-3 left-1/2 -translate-x-1/2 z-20
            px-4 py-2 bg-gray-900 text-white rounded-full shadow-lg text-sm font-medium
            animate-pulse">
            + {lastAdded}
          </div>
        )}

        {/* Mobile FAB: show tray */}
        {!trayOpen && stops.length > 0 && (
          <button
            onClick={() => setTrayOpen(true)}
            className="sm:hidden absolute bottom-4 left-1/2 -translate-x-1/2 z-20
              px-5 py-3 bg-gray-900 text-white rounded-full shadow-lg text-sm font-medium
              flex items-center gap-2"
          >
            <span>已選 {stops.length} 間</span>
            {closedStops.length > 0 && (
              <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{closedStops.length} 公休</span>
            )}
            <span>▴</span>
          </button>
        )}
      </div>
    </div>
  );
}
