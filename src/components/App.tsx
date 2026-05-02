import { useCallback, useMemo, useState } from 'react';
import type { Shop } from '../types/shop';
import { CategoryTabs } from './CategoryTabs';
import { ShopGrid } from './ShopGrid';
import { ShopDetail } from './ShopDetail';
import { TimeBar } from './TimeBar';
import { isOpenAt, toJST } from '../utils/openStatus';
import { haversine } from '../utils/distance';
import shopsData from '../data/shops.json';

const base = import.meta.env.BASE_URL;
const resolveImg = (p: string) => p ? `${base}${p.replace(/^\//, '')}` : '';
const shops = (shopsData as Shop[]).map((s) => ({
  ...s,
  photoUrl: resolveImg(s.photoUrl),
  photos: s.photos?.map(resolveImg).filter(Boolean) || [],
}));

interface UserLocation {
  lat: number;
  lng: number;
}

export function App() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [checkTime, setCheckTime] = useState(() => new Date());
  const [showOnlyOpen, setShowOnlyOpen] = useState(() => {
    try { return localStorage.getItem('pref:showOnlyOpen') === 'true'; } catch { return false; }
  });
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [sortByDistance, setSortByDistance] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    try { const v = localStorage.getItem('pref:viewMode'); return v === 'list' ? 'list' : 'grid'; } catch { return 'grid'; }
  });

  const persistViewMode = useCallback((mode: 'grid' | 'list') => {
    setViewMode(mode);
    try { localStorage.setItem('pref:viewMode', mode); } catch {}
  }, []);

  const persistShowOnlyOpen = useCallback(() => {
    setShowOnlyOpen((v) => {
      try { localStorage.setItem('pref:showOnlyOpen', String(!v)); } catch {}
      return !v;
    });
  }, []);

  const matchesCategory = useCallback((s: Shop, cat: string) => {
    return s.category === cat || (s.tags?.includes(cat) === true);
  }, []);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of shops) {
      map[s.category] = (map[s.category] || 0) + 1;
      for (const tag of s.tags || []) {
        if (tag !== s.category) {
          map[tag] = (map[tag] || 0) + 1;
        }
      }
    }
    return map;
  }, []);

  const jst = useMemo(() => toJST(checkTime), [checkTime]);

  const openStatusMap = useMemo(() => {
    const map = new Map<number, boolean | null>();
    for (const s of shops) {
      map.set(s.id, isOpenAt(s.hours, jst));
    }
    return map;
  }, [jst]);

  const distanceMap = useMemo(() => {
    const map = new Map<number, number>();
    if (!userLocation) return map;
    for (const s of shops) {
      if (s.lat && s.lng) {
        map.set(s.id, haversine(userLocation.lat, userLocation.lng, s.lat, s.lng));
      }
    }
    return map;
  }, [userLocation]);

  const filtered = useMemo(() => {
    let result = shops;
    if (activeCategory) {
      result = result.filter((s) => matchesCategory(s, activeCategory));
    }
    if (showOnlyOpen) {
      result = result.filter((s) => openStatusMap.get(s.id) === true);
    }

    result = [...result];

    if (sortByDistance && userLocation) {
      result.sort((a, b) => {
        const da = distanceMap.get(a.id) ?? Infinity;
        const db = distanceMap.get(b.id) ?? Infinity;
        return da - db;
      });
    }
    return result;
  }, [activeCategory, showOnlyOpen, openStatusMap, sortByDistance, userLocation, distanceMap]);

  const openCount = useMemo(() => {
    const currentFiltered = activeCategory
      ? shops.filter((s) => matchesCategory(s, activeCategory))
      : shops;
    return currentFiltered.filter((s) => openStatusMap.get(s.id) === true).length;
  }, [activeCategory, openStatusMap]);

  const handleTimeChange = useCallback((d: Date) => setCheckTime(d), []);
  const handleToggleFilter = persistShowOnlyOpen;

  const handleLocate = useCallback(() => {
    if (userLocation) {
      // Toggle off
      setUserLocation(null);
      setSortByDistance(false);
      return;
    }
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setSortByDistance(true);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [userLocation]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            東京專門店地圖
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            98 個領域 · {shops.length} 間店
          </p>
        </div>
      </header>

      <TimeBar
        checkTime={checkTime}
        onTimeChange={handleTimeChange}
        openCount={openCount}
        totalCount={filtered.length}
        showOnlyOpen={showOnlyOpen}
        onToggleFilter={handleToggleFilter}
        userLocation={userLocation}
        locating={locating}
        sortByDistance={sortByDistance}
        onLocate={handleLocate}
        onToggleSortDistance={() => setSortByDistance((v) => !v)}
      />

      <CategoryTabs
        activeCategory={activeCategory}
        onSelect={(key) => { setActiveCategory(key); window.scrollTo({ top: 0 }); }}
        counts={counts}
        viewMode={viewMode}
        onViewModeChange={persistViewMode}
      />

      <main className="max-w-7xl mx-auto">
        <ShopGrid
          shops={filtered}
          onSelect={setSelectedShop}
          openStatusMap={openStatusMap}
          distanceMap={distanceMap}
          viewMode={viewMode}
        />
      </main>

      {selectedShop && (
        <ShopDetail
          shop={selectedShop}
          onClose={() => setSelectedShop(null)}
          isOpen={openStatusMap.get(selectedShop.id) ?? null}
          distance={distanceMap.get(selectedShop.id)}
        />
      )}
    </div>
  );
}
