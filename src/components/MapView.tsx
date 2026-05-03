import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap, type MapMouseEvent } from '@vis.gl/react-google-maps';
import type { Shop } from '../types/shop';
import { classifyShops, saveImportedShops, type ImportPreview } from '../lib/importShops';
import { supabase } from '../lib/supabase';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

interface Props {
  shops: Shop[];
  onSelect: (shop: Shop) => void;
  openStatusMap: Map<number, boolean | null>;
  distanceMap: Map<number, number>;
  isAdmin?: boolean;
  categoryMap: Map<string, number>;
  onImportDone?: () => void;
}

function MapInner({ shops, onSelect, openStatusMap, isAdmin, categoryMap, onImportDone }: Props) {
  const map = useMap();
  const [activeShopId, setActiveShopId] = useState<number | null>(null);
  const activeShop = useMemo(() => shops.find(s => s.id === activeShopId), [shops, activeShopId]);

  // Search state
  const [searchPreview, setSearchPreview] = useState<ImportPreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // Fit bounds when shops change
  useEffect(() => {
    if (!map || shops.length === 0) return;
    const validShops = shops.filter(s => s.lat && s.lng);
    if (validShops.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    for (const s of validShops) {
      bounds.extend({ lat: s.lat, lng: s.lng });
    }
    map.fitBounds(bounds, { top: 60, bottom: 40, left: 40, right: 40 });

    const listener = google.maps.event.addListenerOnce(map, 'idle', () => {
      const zoom = map.getZoom();
      if (zoom && zoom > 16) map.setZoom(16);
    });
    return () => google.maps.event.removeListener(listener);
  }, [map, shops]);

  // Setup Places Autocomplete (New API)
  useEffect(() => {
    if (!isAdmin || !map || !autocompleteRef.current) return;
    if (!google.maps.places?.PlaceAutocompleteElement) return;

    const el = new google.maps.places.PlaceAutocompleteElement({
      includedRegionCodes: ['jp'],
      requestedLanguage: 'ja',
    });
    el.style.width = '100%';
    el.style.height = '38px';

    autocompleteRef.current.innerHTML = '';
    autocompleteRef.current.appendChild(el);

    el.addEventListener('gmp-select', async (e: Event) => {
      const selectEvent = e as google.maps.places.PlacePredictionSelectEvent;
      const place = selectEvent.placePrediction?.toPlace();
      if (!place) return;

      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount', 'websiteURI', 'googleMapsURI', 'regularOpeningHours', 'photos', 'types'],
      });

      const loc = place.location;
      if (!loc) return;

      const lat = loc.lat();
      const lng = loc.lng();

      map.panTo({ lat, lng });
      map.setZoom(16);

      // Get a photo URL if available
      const photos = place.photos || [];
      let photoUrl = '';
      if (photos.length > 0) {
        try {
          const uri = photos[0].getURI({ maxWidth: 400 });
          if (uri) photoUrl = uri;
        } catch { /* no photo */ }
      }

      const preview: ImportPreview = {
        name: place.displayName || '',
        address: place.formattedAddress || '',
        lat,
        lng,
        rating: (place as unknown as Record<string, number>).rating || 0,
        reviewCount: place.userRatingCount || 0,
        website: place.websiteURI || '',
        googleMapsUrl: place.googleMapsURI || '',
        hours: place.regularOpeningHours?.weekdayDescriptions || [],
        photos: photoUrl ? [photoUrl] : [],
        primaryType: place.types?.[0] || '',
        status: 'new',
      };

      setSearchPreview(preview);
      setSaveStatus('idle');
      setActiveShopId(null);
    });

    return () => {
      el.remove();
    };
  }, [isAdmin, map]);

  const handleAddShop = useCallback(async (preview: ImportPreview) => {
    setSaving(true);
    setSaveStatus('saving');
    try {
      // Fetch full data (photos, hours) via import function
      let shopToSave = preview;
      if (preview.googleMapsUrl) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/import-shops`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ urls: [preview.googleMapsUrl] }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.shops?.[0]) {
              shopToSave = { ...preview, ...data.shops[0], status: preview.status };
            }
          }
        }
      }

      // Translate hours if in Japanese
      if (shopToSave.hours.length > 0 && shopToSave.hours[0].includes('曜日')) {
        const dayMap: Record<string, string> = {
          '月曜日': '週一', '火曜日': '週二', '水曜日': '週三', '木曜日': '週四',
          '金曜日': '週五', '土曜日': '週六', '日曜日': '週日',
        };
        shopToSave.hours = shopToSave.hours.map(h => {
          for (const [jp, zh] of Object.entries(dayMap)) h = h.replace(jp, zh);
          h = h.replace('定休日', '公休').replace('24 時間営業', '24 小時營業');
          h = h.replace(/(\d+)時(\d+)分/g, '$1:$2');
          return h;
        });
      }

      const [classified] = await classifyShops([shopToSave]);
      await saveImportedShops([classified], categoryMap);
      setSaveStatus('saved');
      onImportDone?.();
    } catch (err) {
      console.error('Failed to add shop:', err);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }, [categoryMap, onImportDone]);

  const clearSearch = useCallback(() => {
    setSearchPreview(null);
    setSaveStatus('idle');
  }, []);

  // Handle clicking a Google Maps POI
  const [poiLoading, setPoiLoading] = useState(false);

  const handleClickPoi = useCallback(async (placeId: string, latLng: google.maps.LatLngLiteral) => {
    if (poiLoading || saving) return;

    // Check if it's an existing shop at this location
    const existing = shops.find(s =>
      s.lat && s.lng && Math.abs(s.lat - latLng.lat) < 0.0001 && Math.abs(s.lng - latLng.lng) < 0.0001
    );
    if (existing) {
      setActiveShopId(existing.id);
      setSearchPreview(null);
      return;
    }

    setPoiLoading(true);
    setActiveShopId(null);

    try {
      const { Place } = await google.maps.importLibrary('places') as google.maps.PlacesLibrary;
      const place = new Place({ id: placeId });
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount',
                 'websiteURI', 'googleMapsURI', 'regularOpeningHours', 'photos', 'types'],
      });

      const loc = place.location;
      if (!loc) return;

      const photos = place.photos || [];
      let photoUrl = '';
      if (photos.length > 0) {
        try {
          const uri = photos[0].getURI({ maxWidth: 400 });
          if (uri) photoUrl = uri;
        } catch { /* skip */ }
      }

      const preview: ImportPreview = {
        name: place.displayName || '',
        address: place.formattedAddress || '',
        lat: loc.lat(),
        lng: loc.lng(),
        rating: (place as unknown as Record<string, number>).rating || 0,
        reviewCount: place.userRatingCount || 0,
        website: place.websiteURI || '',
        googleMapsUrl: place.googleMapsURI || '',
        hours: place.regularOpeningHours?.weekdayDescriptions || [],
        photos: photoUrl ? [photoUrl] : [],
        primaryType: place.types?.[0] || '',
        status: 'new',
      };

      setSearchPreview(preview);
      setSaveStatus('idle');
    } catch (err) {
      console.error('POI fetch failed:', err);
    } finally {
      setPoiLoading(false);
    }
  }, [poiLoading, saving, shops]);

  return (
    <>
      <Map
        defaultCenter={{ lat: 35.6762, lng: 139.6503 }}
        defaultZoom={12}
        mapId="tokyo-shops-map"
        gestureHandling="greedy"
        disableDefaultUI={false}
        zoomControl={true}
        streetViewControl={false}
        fullscreenControl={false}
        style={{ width: '100%', height: '100%' }}
        onClick={(e: MapMouseEvent) => {
          const placeId = e.detail.placeId;
          const latLng = e.detail.latLng;
          if (isAdmin && placeId && latLng) {
            e.stop();
            handleClickPoi(placeId, latLng);
          }
        }}
      >
        {/* Existing shop markers */}
        {shops.map(shop => {
          if (!shop.lat || !shop.lng) return null;
          const openStatus = openStatusMap.get(shop.id);
          const isOpen = openStatus === true;
          const isClosed = openStatus === false;
          const dotColor = isOpen ? '#22c55e' : isClosed ? '#9ca3af' : '#60a5fa';
          const isActive = activeShopId === shop.id;

          return (
            <AdvancedMarker
              key={shop.id}
              position={{ lat: shop.lat, lng: shop.lng }}
              onClick={() => { setActiveShopId(shop.id); setSearchPreview(null); }}
              zIndex={isActive ? 1000 : isOpen ? 2 : 1}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                {/* Pin body */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  backgroundColor: isActive ? dotColor : 'white',
                  border: `2px solid ${dotColor}`,
                  borderRadius: 20, padding: '3px 8px 3px 4px',
                  boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.2)',
                  transform: isActive ? 'scale(1.15)' : 'scale(1)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  whiteSpace: 'nowrap',
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    backgroundColor: isActive ? 'white' : dotColor,
                    flexShrink: 0,
                  }} />
                  <span style={{
                    fontSize: 11, fontWeight: 600, lineHeight: 1,
                    color: isActive ? 'white' : '#374151',
                    maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {shop.name}
                  </span>
                </div>
                {/* Pin tail */}
                <div style={{
                  width: 0, height: 0,
                  borderLeft: '5px solid transparent',
                  borderRight: '5px solid transparent',
                  borderTop: `5px solid ${isActive ? dotColor : 'white'}`,
                  marginTop: -1,
                  filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.15))',
                }} />
              </div>
            </AdvancedMarker>
          );
        })}

        {/* Search result marker */}
        {searchPreview && searchPreview.lat && searchPreview.lng && (
          <AdvancedMarker position={{ lat: searchPreview.lat, lng: searchPreview.lng }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              backgroundColor: '#f59e0b', border: '3px solid white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: 'white', fontWeight: 700,
            }}>
              +
            </div>
          </AdvancedMarker>
        )}

        {/* InfoWindow for existing shop */}
        {activeShop && activeShop.lat && activeShop.lng && (
          <InfoWindow
            position={{ lat: activeShop.lat, lng: activeShop.lng }}
            onCloseClick={() => setActiveShopId(null)}
            pixelOffset={[0, -10]}
          >
            <div
              style={{ minWidth: 200, cursor: 'pointer', maxWidth: 280 }}
              onClick={() => { onSelect(activeShop); setActiveShopId(null); }}
            >
              {activeShop.photoUrl && (
                <img src={activeShop.photoUrl} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 6, marginBottom: 8 }} />
              )}
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>{activeShop.name}</div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 3 }}>
                {activeShop.subcategory}{activeShop.specialty ? ' · ' + activeShop.specialty : ''}
              </div>
              {activeShop.rating && (
                <div style={{ fontSize: 12, color: '#888' }}>
                  ★ {activeShop.rating}{activeShop.reviewCount ? ` (${activeShop.reviewCount})` : ''}
                </div>
              )}
              <div style={{ fontSize: 11, color: '#2563eb', marginTop: 6 }}>點擊查看詳情 →</div>
            </div>
          </InfoWindow>
        )}

        {/* InfoWindow for search result — the "add shop" card */}
        {searchPreview && searchPreview.lat && searchPreview.lng && (
          <InfoWindow
            position={{ lat: searchPreview.lat, lng: searchPreview.lng }}
            onCloseClick={clearSearch}
            pixelOffset={[0, -16]}
          >
            <div style={{ minWidth: 220, maxWidth: 300 }}>
              {searchPreview.photos[0] && (
                <img
                  src={searchPreview.photos[0]}
                  style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 6, marginBottom: 8 }}
                  referrerPolicy="no-referrer"
                />
              )}
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>{searchPreview.name}</div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 3 }}>{searchPreview.address}</div>
              {searchPreview.rating > 0 && (
                <div style={{ fontSize: 12, color: '#888', marginBottom: 3 }}>
                  ★ {searchPreview.rating}{searchPreview.reviewCount ? ` (${searchPreview.reviewCount} 則評論)` : ''}
                </div>
              )}
              {searchPreview.primaryType && (
                <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>{searchPreview.primaryType}</div>
              )}

              {saveStatus === 'saved' ? (
                <div style={{
                  padding: '8px 0', textAlign: 'center',
                  color: '#16a34a', fontWeight: 600, fontSize: 14,
                }}>
                  已加入！
                </div>
              ) : saveStatus === 'error' ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, padding: '6px 0', color: '#dc2626', fontSize: 13 }}>新增失敗</div>
                  <button
                    onClick={() => handleAddShop(searchPreview)}
                    style={{
                      padding: '8px 16px', borderRadius: 8,
                      backgroundColor: '#2563eb', color: 'white',
                      fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer',
                    }}
                  >
                    重試
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleAddShop(searchPreview)}
                  disabled={saving}
                  style={{
                    width: '100%', padding: '10px 0', borderRadius: 8,
                    backgroundColor: saving ? '#93c5fd' : '#2563eb',
                    color: 'white', fontWeight: 600, fontSize: 14,
                    border: 'none', cursor: saving ? 'wait' : 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => { if (!saving) e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
                  onMouseLeave={(e) => { if (!saving) e.currentTarget.style.backgroundColor = '#2563eb'; }}
                >
                  {saving ? '加入中（AI 分類 + 照片下載）...' : '+ 加入我的地圖'}
                </button>
              )}
            </div>
          </InfoWindow>
        )}
      </Map>

      {/* Search bar — admin only */}
      {isAdmin && (
        <div className="absolute top-3 left-3 z-10" style={{ width: 'min(400px, calc(100% - 80px))' }}>
          <div ref={autocompleteRef} className="rounded-lg shadow-lg" />
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-10 bg-white/95 backdrop-blur-sm rounded-lg shadow-md px-3 py-2 text-xs">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" /> 營業中</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-400" /> 休息</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-400" /> 不明</span>
        </div>
      </div>
    </>
  );
}

export function MapView(props: Props) {
  return (
    <div className="relative" style={{ height: 'calc(100vh - 120px)', minHeight: '400px' }}>
      <APIProvider apiKey={API_KEY} libraries={['places']}>
        <MapInner {...props} />
      </APIProvider>
    </div>
  );
}
