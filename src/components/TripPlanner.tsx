import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APIProvider, Map as GoogleMap, AdvancedMarker, InfoWindow, useMap, type MapMouseEvent } from '@vis.gl/react-google-maps';
import type { Shop } from '../types/shop';
import type { TripStop } from '../types/trip';
import { getOpenWindow } from '../utils/openWindow';
import { clusterStops, interClusterWalkMinutes } from '../utils/clustering';
import { haversine } from '../utils/distance';
import { toJST } from '../utils/openStatus';
import { TripStopList } from './TripStopList';
import type { RouteSuggestion } from './TripSuggestion';
import { supabase } from '../lib/supabase';
import { saveTripAsync, updateTripAsync, type SavedTrip } from '../lib/tripStorage';
import { useTimeline } from '../hooks/useTimeline';
import { useTripRealtime } from '../hooks/useTripRealtime';
import { useTripPresence } from '../hooks/useTripPresence';
import { fetchListShopIds, fetchShops } from '../lib/api';
import { fetchTripMembers, removeTripMember } from '../lib/tripCollabApi';
import { classifyShops, saveImportedShops, type ImportPreview } from '../lib/importShops';
import type { List } from '../types/list';
import type { TripMember, TripRole } from '../types/trip';
import type { User } from '@supabase/supabase-js';
import { TimeRangePicker } from './TimeRangePicker';
import { MobileDrawer } from './MobileDrawer';
import { EditorAvatars } from './EditorAvatars';
import { TripShareButton } from './TripShareButton';
import { TripMemberList } from './TripMemberList';

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
  lists?: List[];
  onClose: () => void;
  loadTrip?: SavedTrip;
  inline?: boolean;
  user?: User | null;
}

function TripMapInner({ shops, tripDate, onAddShop, onRemoveShop, selectedShopIds, editMode, orderedStops, userLoc, onLocate, activeShopId, onSetActiveShop, onClickPoi }: {
  shops: Shop[];
  tripDate: Date;
  onAddShop: (shop: Shop) => void;
  onRemoveShop: (shopId: number) => void;
  selectedShopIds: Set<number>;
  editMode: boolean;
  orderedStops: Shop[];
  userLoc: { lat: number; lng: number } | null;
  onLocate?: (loc: { lat: number; lng: number }) => void;
  activeShopId: number | null;
  onSetActiveShop: (shopId: number | null) => void;
  onClickPoi?: (placeId: string, latLng: google.maps.LatLngLiteral) => void;
}) {
  const map = useMap();
  const activeShop = shops.find(s => s.id === activeShopId) || null;

  // Pan to active shop when selected from list
  useEffect(() => {
    if (!map || !activeShop?.lat || !activeShop?.lng) return;
    map.panTo({ lat: activeShop.lat, lng: activeShop.lng });
    if (map.getZoom()! < 14) map.setZoom(15);
  }, [map, activeShop]);

  // Stable key for ordered stops — only changes when shop IDs or order actually change
  const stopsKey = orderedStops.map(s => s.id).join(',');
  // Keep a ref to the latest orderedStops so effects can read current data without depending on the reference
  const orderedStopsRef = useRef(orderedStops);
  orderedStopsRef.current = orderedStops;

  // In view mode: fit bounds to selected shops (only on mode switch or stops change)
  useEffect(() => {
    if (!map) return;
    const stops = orderedStopsRef.current;
    if (!editMode && stops.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      for (const s of stops) {
        if (s.lat && s.lng) bounds.extend({ lat: s.lat, lng: s.lng });
      }
      map.fitBounds(bounds, { top: 60, bottom: 40, left: 40, right: 40 });
    } else if (stops.length === 0) {
      map.setCenter({ lat: 35.6762, lng: 139.6503 });
      map.setZoom(12);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, editMode, stopsKey]);

  // Draw route via Routes API (New) with fallback to straight lines
  useEffect(() => {
    if (!map) return;

    const points = orderedStopsRef.current
      .filter(s => s.lat && s.lng)
      .map(s => ({ lat: s.lat, lng: s.lng }));

    if (points.length < 2) return;

    let polyline: google.maps.Polyline | null = null;
    let cancelled = false;

    // Try Routes API (New)
    (async () => {
      try {
        const apiKey = API_KEY;
        const body = {
          origin: { location: { latLng: { latitude: points[0].lat, longitude: points[0].lng } } },
          destination: { location: { latLng: { latitude: points[points.length - 1].lat, longitude: points[points.length - 1].lng } } },
          intermediates: points.slice(1, -1).map(p => ({
            location: { latLng: { latitude: p.lat, longitude: p.lng } },
          })),
          travelMode: 'WALK',
          polylineEncoding: 'GEO_JSON_LINESTRING',
        };

        const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'routes.polyline',
          },
          body: JSON.stringify(body),
        });

        if (cancelled) return;

        if (res.ok) {
          const data = await res.json();
          const geoJson = data.routes?.[0]?.polyline?.geoJsonLinestring;
          if (geoJson?.coordinates) {
            const path = geoJson.coordinates.map((c: [number, number]) => ({ lat: c[1], lng: c[0] }));
            if (!cancelled) {
              polyline = new google.maps.Polyline({
                path,
                strokeColor: '#2563eb',
                strokeOpacity: 0.7,
                strokeWeight: 4,
                geodesic: true,
                map,
              });
            }
            return;
          }
        }
        throw new Error('Routes API failed');
      } catch {
        // Fallback: straight lines
        if (!cancelled) {
          polyline = new google.maps.Polyline({
            path: points,
            strokeColor: '#2563eb',
            strokeOpacity: 0.5,
            strokeWeight: 3,
            geodesic: true,
            map,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      polyline?.setMap(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, stopsKey]);

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
        onClick={(e: MapMouseEvent) => {
          const placeId = e.detail.placeId;
          const latLng = e.detail.latLng;
          if (editMode && placeId && latLng && onClickPoi) {
            e.stop();
            onClickPoi(placeId, latLng);
          }
        }}
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
              onClick={() => onSetActiveShop(shop.id)}
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
            onCloseClick={() => onSetActiveShop(null)}
            pixelOffset={[0, -16]}
          >
            <div style={{ minWidth: 220, maxWidth: 300 }}>
              {/* Photo */}
              {activeShop.photoUrl && (
                <img src={activeShop.photoUrl} style={{ width: 'calc(100% + 16px)', height: 120, objectFit: 'cover', borderRadius: '6px 6px 0 0', margin: '-12px -8px 8px -8px' }} />
              )}

              {/* Name + category */}
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{activeShop.name}</div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                {activeShop.subcategory}{activeShop.specialty ? ' · ' + activeShop.specialty : ''}
              </div>

              {/* Rating */}
              {activeShop.rating && (
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
                  ★ {activeShop.rating}{activeShop.reviewCount ? ` (${activeShop.reviewCount})` : ''}
                </div>
              )}

              {/* Description */}
              {activeShop.description && (
                <div style={{ fontSize: 12, color: '#555', marginBottom: 6, lineHeight: 1.4 }}>
                  {activeShop.description}
                </div>
              )}

              {/* Hours */}
              {(() => {
                const result = getOpenWindow(activeShop.hours, tripDate);
                if (result === null) return <div style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>營業時間不明</div>;
                if (result.closed) return <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 6 }}>當天公休</div>;
                return <div style={{ fontSize: 12, color: '#22c55e', marginBottom: 6 }}>營業 {result.window.openStr}～{result.window.closeStr}</div>;
              })()}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 6 }}>
                {/* Add/Remove */}
                <button
                  onClick={() => {
                    if (selectedShopIds.has(activeShop.id)) {
                      onRemoveShop(activeShop.id);
                    } else {
                      onAddShop(activeShop);
                    }
                    onSetActiveShop(null);
                  }}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8,
                    backgroundColor: selectedShopIds.has(activeShop.id) ? '#fee2e2' : '#2563eb',
                    color: selectedShopIds.has(activeShop.id) ? '#ef4444' : 'white',
                    fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer',
                  }}
                >
                  {selectedShopIds.has(activeShop.id) ? '移除' : '+ 想去'}
                </button>

                {/* Navigate */}
                <a
                  href={activeShop.googleMapsUrl || `https://www.google.com/maps/dir/?api=1&destination=${activeShop.lat},${activeShop.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '8px 12px', borderRadius: 8,
                    backgroundColor: '#f3f4f6', color: '#374151',
                    fontWeight: 600, fontSize: 13, textDecoration: 'none',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  導航
                </a>
              </div>
            </div>
          </InfoWindow>
        )}

        {/* User location marker */}
        {userLoc && (
          <AdvancedMarker position={userLoc} zIndex={100}>
            <div style={{
              width: 16, height: 16, borderRadius: '50%',
              backgroundColor: '#4285F4',
              border: '3px solid white',
              boxShadow: '0 0 0 2px rgba(66,133,244,0.3), 0 2px 6px rgba(0,0,0,0.3)',
            }} />
          </AdvancedMarker>
        )}
      </GoogleMap>

      {/* My location button */}
      <button
        onClick={() => {
          if (userLoc && map) {
            map.panTo(userLoc);
            map.setZoom(16);
          } else {
            navigator.geolocation?.getCurrentPosition(
              (pos) => {
                const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                onLocate?.(loc);
                map?.panTo(loc);
                map?.setZoom(16);
              },
              () => {},
              { enableHighAccuracy: true, timeout: 10000 },
            );
          }
        }}
        className="absolute bottom-4 right-4 z-10 w-10 h-10 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
        title="移動到我的位置"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={userLoc ? '#4285F4' : '#9ca3af'} strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
      </button>
    </>
  );
}

export function TripPlanner({ shops, categories, lists, onClose, loadTrip, inline, user }: Props) {
  // Filter state
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Collaborative state
  const isCollab = loadTrip?.isCollaborative ?? false;
  const [collabEnabled, setCollabEnabled] = useState(isCollab);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [myRole, setMyRole] = useState<TripRole>('owner');
  const [showMembers, setShowMembers] = useState(false);

  // Realtime hooks (only active when collaborative)
  const rt = useTripRealtime(loadTrip?.id ?? null, collabEnabled);
  const presenceUser = useMemo(() => {
    if (!user) return null;
    const meta = user.user_metadata;
    return {
      userId: user.id,
      displayName: meta?.full_name || meta?.name || '',
      avatarUrl: meta?.avatar_url || meta?.picture || '',
    };
  }, [user]);
  const activeEditors = useTripPresence(loadTrip?.id ?? null, collabEnabled, presenceUser);

  // Load members for collaborative trips
  useEffect(() => {
    if (!collabEnabled || !loadTrip?.id) return;
    fetchTripMembers(loadTrip.id).then(m => {
      setMembers(m);
      if (user) {
        const me = m.find(mem => mem.userId === user.id);
        if (me) setMyRole(me.role);
      }
    }).catch(console.error);
  }, [collabEnabled, loadTrip?.id, user]);

  const canEdit = myRole === 'owner' || myRole === 'editor';

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
  const [mobileReorderMode, setMobileReorderMode] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(420);
  const resizingRef = useRef(false);
  const [suggesting, setSuggesting] = useState(false);
  const [aiNotes, setAiNotes] = useState<Map<number, string>>(new Map()); // shopId → AI note
  const [aiSummary, setAiSummary] = useState<string>('');
  const [extraInput, setExtraInput] = useState<string>('');
  const [shopDurations, setShopDurations] = useState<Map<number, number>>(() => {
    if (!loadTrip?.shopDurations) return new Map();
    const m = new Map<number, number>();
    for (const [k, v] of Object.entries(loadTrip.shopDurations)) {
      m.set(Number(k), v);
    }
    return m;
  });
  const [editMode, setEditMode] = useState(!loadTrip);
  const [importListOpen, setImportListOpen] = useState(false);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [activeShopId, setActiveShopId] = useState<number | null>(null);
  const [poiLoading, setPoiLoading] = useState(false);
  const [poiPreview, setPoiPreview] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [allShops, setAllShops] = useState(shops);

  // Keep allShops in sync with parent + newly added
  useEffect(() => {
    setAllShops(prev => {
      const parentIds = new Set(shops.map(s => s.id));
      // Keep locally-added shops that aren't in parent yet
      const localOnly = prev.filter(s => !parentIds.has(s.id));
      return [...shops, ...localOnly];
    });
  }, [shops]);

  // When collaborative, use realtime data; otherwise local state
  const effectiveShopIds = collabEnabled ? rt.shopIds : orderedShopIds;
  const effectiveVisitedIds = collabEnabled ? rt.visitedIds : visitedIds;
  const effectiveShopDurations = collabEnabled ? rt.shopDurations : shopDurations;

  // Ordered shops for route drawing
  const orderedStops = useMemo(() => {
    return effectiveShopIds
      .map(id => allShops.find(s => s.id === id))
      .filter((s): s is Shop => s !== null && s !== undefined && !!s.lat && !!s.lng);
  }, [effectiveShopIds, allShops]);

  // Derived: selectedShopIds as Set for quick lookup
  const selectedShopIds = useMemo(() => new Set(effectiveShopIds), [effectiveShopIds]);

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
    return effectiveShopIds.map(id => {
      const shop = allShops.find(s => s.id === id);
      if (!shop) return null;

      const result = getOpenWindow(shop.hours, tripDateJST);
      return {
        shop,
        openWindow: result?.closed === false ? result.window : null,
        closed: result?.closed === true,
        visited: effectiveVisitedIds.has(id),
      };
    }).filter((s): s is TripStop => s !== null);
  }, [effectiveShopIds, shops, tripDateJST, effectiveVisitedIds]);

  // Split into active and closed
  const activeStops = useMemo(() => stops.filter(s => !s.closed), [stops]);
  const closedStops = useMemo(() => stops.filter(s => s.closed), [stops]);

  // Cluster active stops
  const clusters = useMemo(() => clusterStops(activeStops), [activeStops]);

  // Timeline calculation
  const hasTimeWindow = startTime !== '' && endTime !== '';
  const timeline = useTimeline(clusters, startTime, effectiveShopDurations);

  // Feasibility (only when time window is set)
  const feasibility = useMemo(() => {
    if (!hasTimeWindow) return undefined;

    const startMin = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1] || '0');
    const endMin = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1] || '0');
    const available = endMin - startMin;

    // Use actual durations from shopDurations map
    let shopTime = 0;
    for (const stop of activeStops) {
      shopTime += effectiveShopDurations.get(stop.shop.id) ?? stop.shop.visitDuration ?? 20;
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
    if (collabEnabled) {
      const shop = allShops.find(s => s.id === shopId);
      const defaultDur = shop?.visitDuration ?? 20;
      rt.updateDuration(shopId, duration === defaultDur ? null : duration);
    } else {
      setShopDurations(prev => {
        const next = new Map(prev);
        const shop = shops.find(s => s.id === shopId);
        const defaultDur = shop?.visitDuration ?? 20;
        if (duration === defaultDur) next.delete(shopId);
        else next.set(shopId, duration);
        return next;
      });
    }
  }, [shops, collabEnabled, rt]);

  const [lastAdded, setLastAdded] = useState<string | null>(null);

  const handleAddShop = useCallback((shop: Shop) => {
    if (collabEnabled) {
      rt.addShop(shop.id);
    } else {
      setOrderedShopIds(prev => prev.includes(shop.id) ? prev : [...prev, shop.id]);
    }
    setLastAdded(shop.name);
    setTimeout(() => setLastAdded(null), 1500);
  }, [collabEnabled, rt]);

  const handleImportFromList = useCallback(async (listId: string) => {
    const shopIds = await fetchListShopIds(listId);
    if (collabEnabled) {
      const existing = new Set(effectiveShopIds);
      for (const id of shopIds) {
        if (!existing.has(id)) await rt.addShop(id);
      }
    } else {
      setOrderedShopIds(prev => {
        const existing = new Set(prev);
        const newIds = [...shopIds].filter(id => !existing.has(id));
        return [...prev, ...newIds];
      });
    }
    setImportListOpen(false);
  }, [collabEnabled, effectiveShopIds, rt]);

  // Build categoryMap for saving imported shops
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.name, c.id])), [categories]);

  // Handle clicking a Google Maps POI → fetch place details → save to DB → add to trip
  const handleClickPoi = useCallback(async (placeId: string, latLng: google.maps.LatLngLiteral) => {
    if (poiLoading) return;
    setPoiLoading(true);
    setPoiPreview({ name: '載入中...', lat: latLng.lat, lng: latLng.lng });

    try {
      // Use Places API to get details
      const { Place } = await google.maps.importLibrary('places') as google.maps.PlacesLibrary;
      const place = new Place({ id: placeId });
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount',
                 'websiteURI', 'googleMapsURI', 'regularOpeningHours', 'photos', 'types'],
      });

      const loc = place.location;
      if (!loc) { setPoiPreview(null); return; }

      const lat = loc.lat();
      const lng = loc.lng();
      const name = place.displayName || '';

      // Check if this shop already exists (by location proximity)
      const existing = allShops.find(s =>
        s.lat && s.lng && Math.abs(s.lat - lat) < 0.0001 && Math.abs(s.lng - lng) < 0.0001
      );

      if (existing) {
        // Already in DB — just add to trip
        handleAddShop(existing);
        setPoiPreview(null);
        setPoiLoading(false);
        return;
      }

      // Get photo URLs
      const photos = place.photos || [];
      const photoUrls: string[] = [];
      for (const photo of photos.slice(0, 3)) {
        try {
          const uri = photo.getURI({ maxWidth: 400 });
          if (uri) photoUrls.push(uri);
        } catch { /* skip */ }
      }

      // Parse hours
      let hours = place.regularOpeningHours?.weekdayDescriptions || [];
      if (hours.length > 0 && hours[0].includes('曜日')) {
        const dayMap: Record<string, string> = {
          '月曜日': '週一', '火曜日': '週二', '水曜日': '週三', '木曜日': '週四',
          '金曜日': '週五', '土曜日': '週六', '日曜日': '週日',
        };
        hours = hours.map(h => {
          for (const [jp, zh] of Object.entries(dayMap)) h = h.replace(jp, zh);
          h = h.replace('定休日', '公休').replace('24 時間営業', '24 小時營業');
          h = h.replace(/(\d+)時(\d+)分/g, '$1:$2');
          return h;
        });
      }

      const preview: ImportPreview = {
        name,
        address: place.formattedAddress || '',
        lat,
        lng,
        rating: (place as unknown as Record<string, number>).rating || 0,
        reviewCount: place.userRatingCount || 0,
        website: place.websiteURI || '',
        googleMapsUrl: place.googleMapsURI || '',
        hours,
        photos: photoUrls,
        primaryType: place.types?.[0] || '',
        status: 'new',
      };

      setPoiPreview({ name, lat, lng });

      // Classify with AI then save to DB
      const [classified] = await classifyShops([preview]);
      await saveImportedShops([classified], categoryMap);

      // Re-fetch shops to get the new shop with its DB id
      const freshShops = await fetchShops();
      const newShop = freshShops.find(s =>
        s.lat && s.lng && Math.abs(s.lat - lat) < 0.0001 && Math.abs(s.lng - lng) < 0.0001
      );

      if (newShop) {
        setAllShops(prev => [...prev.filter(s => s.id !== newShop.id), newShop]);
        handleAddShop(newShop);
      }
    } catch (err) {
      console.error('POI add failed:', err);
    } finally {
      setPoiLoading(false);
      setPoiPreview(null);
    }
  }, [poiLoading, allShops, handleAddShop, categoryMap]);

  const handleRemoveShop = useCallback((shopId: number) => {
    if (collabEnabled) {
      rt.removeShop(shopId);
    } else {
      setOrderedShopIds(prev => prev.filter(id => id !== shopId));
    }
  }, [collabEnabled, rt]);

  // Toggle visited
  const handleToggleVisited = useCallback((shopId: number) => {
    if (collabEnabled) {
      rt.toggleVisited(shopId);
    } else {
      setVisitedIds(prev => {
        const next = new Set(prev);
        if (next.has(shopId)) next.delete(shopId);
        else next.add(shopId);
        // Auto-save if trip is saved
        if (savedId) {
          updateTripAsync(savedId, { visitedIds: [...next] }).catch(console.error);
        }
        return next;
      });
    }
  }, [savedId, collabEnabled, rt]);

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
    for (const id of effectiveShopIds) {
      if (!newOrder.includes(id)) newOrder.push(id);
    }
    if (collabEnabled) {
      rt.reorder(newOrder);
    } else {
      setOrderedShopIds(newOrder);
    }
  }, [clusters, effectiveShopIds, collabEnabled, rt]);

  // Reorder shop within a cluster
  const handleReorderShopInCluster = useCallback((clusterIdx: number, fromIdx: number, toIdx: number) => {
    const cluster = clusters[clusterIdx];
    if (!cluster) return;
    const shopIds = cluster.stops.map(s => s.shop.id);
    const [moved] = shopIds.splice(fromIdx, 1);
    shopIds.splice(toIdx, 0, moved);

    // Rebuild full order: replace this cluster's segment
    const newOrder = [...effectiveShopIds];
    const clusterIdSet = new Set(cluster.stops.map(s => s.shop.id));
    const filtered = newOrder.filter(id => !clusterIdSet.has(id));

    // Find where to insert (position of first shop of this cluster in original order)
    const firstOrigIdx = newOrder.findIndex(id => clusterIdSet.has(id));
    filtered.splice(firstOrigIdx, 0, ...shopIds);
    if (collabEnabled) {
      rt.reorder(filtered);
    } else {
      setOrderedShopIds(filtered);
    }
  }, [clusters, effectiveShopIds, collabEnabled, rt]);

  // Save trip
  const handleSave = useCallback(async () => {
    const durObj: Record<string, number> = {};
    effectiveShopDurations.forEach((v, k) => { durObj[String(k)] = v; });

    if (savedId) {
      if (collabEnabled) {
        // Collaborative: only save metadata (shop items are already persisted via realtime)
        await updateTripAsync(savedId, { tripDate, startTime, endTime });
      } else {
        await updateTripAsync(savedId, {
          tripDate,
          startTime,
          endTime,
          shopIds: effectiveShopIds,
          visitedIds: [...effectiveVisitedIds],
          shopDurations: durObj,
        });
      }
    } else {
      const days = ['日', '一', '二', '三', '四', '五', '六'];
      const d = tripDateJST;
      const name = `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]}) 行程`;
      const saved = await saveTripAsync({
        name,
        tripDate,
        startTime,
        endTime,
        shopIds: effectiveShopIds,
        visitedIds: [...effectiveVisitedIds],
        shopDurations: durObj,
      });
      setSavedId(saved.id);
    }
  }, [savedId, tripDate, startTime, endTime, effectiveShopIds, effectiveVisitedIds, tripDateJST, effectiveShopDurations, collabEnabled]);

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
      for (const id of effectiveShopIds) {
        if (!newOrder.includes(id)) newOrder.push(id);
      }

      if (collabEnabled) {
        rt.reorder(newOrder);
      } else {
        setOrderedShopIds(newOrder);
      }
      setAiNotes(notes);
      setAiSummary(data.summary || '');
          } catch (err) {
      console.error('Suggest failed:', err);
      alert('建議路線失敗: ' + (err instanceof Error ? err.message : '未知錯誤'));
    } finally {
      setSuggesting(false);
    }
  }, [hasTimeWindow, activeStops.length, stops, clusters, tripDate, tripDateJST, startTime, endTime, selectedShopIds, effectiveShopIds, collabEnabled, rt]);

  const handleSelectShop = useCallback((shopId: number) => {
    setActiveShopId(shopId);
  }, []);

  // Geolocation watch in view mode
  useEffect(() => {
    if (editMode || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 10000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [editMode]);

  // Distance map for on-the-go mode
  const stopDistances = useMemo(() => {
    if (!userLoc) return new Map<number, number>();
    const m = new Map<number, number>();
    for (const stop of stops) {
      if (stop.shop.lat && stop.shop.lng) {
        m.set(stop.shop.id, haversine(userLoc.lat, userLoc.lng, stop.shop.lat, stop.shop.lng));
      }
    }
    return m;
  }, [userLoc, stops]);

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
      ? 'flex flex-col bg-white overflow-hidden overscroll-none'
      : 'fixed inset-0 bottom-0 z-40 bg-white flex flex-col'
    } style={inline ? { height: 'calc(100dvh - 56px)' } : undefined}>
      {/* Header bar */}
      <div className="shrink-0 bg-white border-b border-gray-200">
        {editMode ? (
          <div className="px-4 py-3">
            {/* Row 1: Back + Date + Collab */}
            <div className="flex items-center gap-3 mb-2">
              <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1 shrink-0">
                <span>←</span>
                <span className="hidden sm:inline">返回</span>
              </button>
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="date"
                  value={tripDate}
                  onChange={e => setTripDate(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50"
                  disabled={collabEnabled && !canEdit}
                />
                <span className="text-sm text-gray-400">週{dayLabel}</span>
              </div>
              {/* Collaboration: avatars + share */}
              {collabEnabled && (
                <div className="relative">
                  {/* Desktop avatars */}
                  <div className="hidden sm:block">
                    <EditorAvatars editors={activeEditors} onExpand={() => setShowMembers(v => !v)} />
                  </div>
                  {/* Mobile compact */}
                  <div className="sm:hidden">
                    <EditorAvatars editors={activeEditors} compact onExpand={() => setShowMembers(v => !v)} />
                  </div>
                  {showMembers && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowMembers(false)} />
                      <div className="absolute right-0 top-full mt-1 z-50">
                        <TripMemberList
                          members={members}
                          onlineUsers={activeEditors}
                          currentUserId={user?.id ?? null}
                          onRemove={myRole === 'owner' ? (userId) => {
                            removeTripMember(savedId!, userId).then(() => {
                              setMembers(prev => prev.filter(m => m.userId !== userId));
                            });
                          } : undefined}
                          onClose={() => setShowMembers(false)}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
              {savedId && user && (
                <TripShareButton
                  tripId={savedId}
                  isCollaborative={collabEnabled}
                  onBecameCollaborative={() => {
                    setCollabEnabled(true);
                    // Reload members
                    fetchTripMembers(savedId).then(setMembers).catch(console.error);
                  }}
                />
              )}
            </div>
            {/* Row 2: Time range slider */}
            <TimeRangePicker
              startTime={startTime || '10:00'}
              endTime={endTime || '18:00'}
              onChange={(s, e) => { setStartTime(s); setEndTime(e); }}
            />
          </div>
        ) : (
          <div className="px-4 py-2.5 flex items-center gap-3">
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1 shrink-0">
              <span>←</span>
              <span className="hidden sm:inline">返回</span>
            </button>
            <div className="flex items-center gap-2 text-sm flex-1">
              <span className="font-medium text-gray-800">{tripDate}</span>
              <span className="text-gray-400">週{dayLabel}</span>
              {startTime && endTime && (
                <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-500 text-xs">{startTime}～{endTime}</span>
              )}
              <span className="text-gray-300">·</span>
              <span className="text-gray-500">{effectiveShopIds.length} 間店</span>
            </div>
            {/* Collaboration: avatars in view mode */}
            {collabEnabled && (
              <>
                <div className="hidden sm:block">
                  <EditorAvatars editors={activeEditors} onExpand={() => setShowMembers(v => !v)} />
                </div>
                <div className="sm:hidden">
                  <EditorAvatars editors={activeEditors} compact onExpand={() => setShowMembers(v => !v)} />
                </div>
              </>
            )}
            {savedId && user && (
              <TripShareButton
                tripId={savedId}
                isCollaborative={collabEnabled}
                onBecameCollaborative={() => {
                  setCollabEnabled(true);
                  fetchTripMembers(savedId).then(setMembers).catch(console.error);
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Main area: map + list */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Map + filters */}
        <div className="flex-1 relative flex flex-col">
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

            {/* Import from list */}
            {lists && lists.length > 0 && (
              <button
                onClick={() => setImportListOpen(v => !v)}
                className="text-xs px-2 py-1 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50"
              >
                從清單匯入
              </button>
            )}

            {/* Selected count */}
            <span className="text-xs text-gray-400 ml-auto">{displayShops.length} 間</span>
          </div>

          {/* Import from list picker */}
          {importListOpen && lists && (
            <div className="shrink-0 bg-white border-b border-gray-100 px-2 py-1.5 flex flex-wrap gap-1">
              {lists.map(list => (
                <button
                  key={list.id}
                  onClick={() => handleImportFromList(list.id)}
                  className="text-xs px-2 py-1 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100"
                >
                  {list.name} ({list.itemCount || 0})
                </button>
              ))}
            </div>
          )}

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
                userLoc={userLoc}
                onLocate={loc => setUserLoc(loc)}
                activeShopId={activeShopId}
                onSetActiveShop={setActiveShopId}
                onClickPoi={handleClickPoi}
              />
            </APIProvider>
          </div>
        </div>

        {/* Desktop: side panel */}
        <div
          className="hidden sm:flex flex-col bg-white border-l border-gray-200 shrink-0 relative"
          style={{ width: sidebarWidth, maxWidth: '50%' }}
        >
          {/* Resize handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-500 z-20"
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
          {/* Panel header */}
          <div className="shrink-0 px-3 py-2 border-b border-gray-100 flex items-center">
            <span className="text-sm font-medium text-gray-700">
              已選 {stops.length} 間
              {closedStops.length > 0 && (
                <span className="text-red-400 ml-1">({closedStops.length} 間公休)</span>
              )}
            </span>
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
            onRemove={editMode && canEdit ? handleRemoveShop : undefined}
            onToggleVisited={handleToggleVisited}
            onReorderClusters={editMode && canEdit ? handleReorderClusters : undefined}
            onReorderShopInCluster={editMode && canEdit ? handleReorderShopInCluster : undefined}
            onDurationChange={editMode && canEdit ? handleDurationChange : undefined}
            onSelectShop={handleSelectShop}
            aiNotes={aiNotes}
            shopDurations={effectiveShopDurations}
            timeline={timeline}
            stopDistances={!editMode ? stopDistances : undefined}
            totalStops={stops.length}
            hasTimeWindow={hasTimeWindow}
            feasibility={feasibility}
          />

          {/* Bottom actions */}
          <div className="shrink-0 p-3 border-t border-gray-100 flex flex-col gap-2">
            {editMode ? (
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

                {/* Save + finish editing */}
                {stops.length > 0 && (
                  <button
                    onClick={() => { handleSave(); setEditMode(false); }}
                    className="w-full py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium
                      hover:bg-emerald-700 transition-colors"
                  >
                    完成編輯
                  </button>
                )}
              </>
            ) : canEdit ? (
              <button
                onClick={() => setEditMode(true)}
                className="w-full py-2.5 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium
                  hover:bg-gray-200 transition-colors"
              >
                編輯行程
              </button>
            ) : null}
          </div>
        </div>

        {/* Mobile: draggable bottom drawer */}
        <MobileDrawer
          open={trayOpen}
          onClose={() => { setTrayOpen(false); setMobileReorderMode(false); }}
          title={mobileReorderMode ? '拖拉排序' : `已選 ${stops.length} 間${closedStops.length > 0 ? ` (${closedStops.length} 間公休)` : ''}`}
          reorderMode={mobileReorderMode}
          onToggleReorder={editMode && canEdit ? () => setMobileReorderMode(v => !v) : undefined}
        >
          {aiSummary && !mobileReorderMode && (
            <div className="shrink-0 px-3 py-2 bg-indigo-50 border-y border-indigo-100 flex items-start gap-2">
              <span className="text-xs text-indigo-600 flex-1">{aiSummary}</span>
              <button onClick={() => { setAiSummary(''); setAiNotes(new Map()); }} className="text-xs text-indigo-400 shrink-0">✕</button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto overscroll-contain">
            <TripStopList
              clusters={clusters}
              closedStops={mobileReorderMode ? [] : closedStops}
              onRemove={editMode && canEdit && !mobileReorderMode ? handleRemoveShop : undefined}
              onToggleVisited={mobileReorderMode ? undefined : handleToggleVisited}
              onReorderClusters={editMode && canEdit ? handleReorderClusters : undefined}
              onReorderShopInCluster={editMode && canEdit ? handleReorderShopInCluster : undefined}
              onDurationChange={editMode && canEdit && !mobileReorderMode ? handleDurationChange : undefined}
              onSelectShop={mobileReorderMode ? undefined : handleSelectShop}
              aiNotes={mobileReorderMode ? undefined : aiNotes}
              shopDurations={effectiveShopDurations}
              timeline={mobileReorderMode ? undefined : timeline}
              stopDistances={!editMode ? stopDistances : undefined}
              totalStops={stops.length}
              hasTimeWindow={hasTimeWindow}
              feasibility={mobileReorderMode ? undefined : feasibility}
              useMoveButtons={mobileReorderMode}
            />
          </div>

          <div className="shrink-0 p-3 border-t border-gray-100 safe-area-bottom flex flex-col gap-2">
            {editMode ? (
              <>
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
                {stops.length > 0 && (
                  <button
                    onClick={() => { handleSave(); setEditMode(false); setTrayOpen(false); }}
                    className="w-full py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium
                      hover:bg-emerald-700 transition-colors"
                  >
                    完成編輯
                  </button>
                )}
              </>
            ) : canEdit ? (
              <button
                onClick={() => setEditMode(true)}
                className="w-full py-2.5 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium
                  hover:bg-gray-200 transition-colors"
              >
                編輯行程
              </button>
            ) : null}
          </div>
        </MobileDrawer>

        {/* POI loading indicator */}
        {poiLoading && poiPreview && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20
            px-4 py-2 bg-blue-600 text-white rounded-full shadow-lg text-sm font-medium
            flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            正在加入 {poiPreview.name}...
          </div>
        )}

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
