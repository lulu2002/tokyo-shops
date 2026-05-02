import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Shop } from '../types/shop';
import { CategoryTabs } from './CategoryTabs';
import { ShopGrid } from './ShopGrid';
import { ShopDetail } from './ShopDetail';
import { TimeBar } from './TimeBar';
import { UserMenu } from './UserMenu';
import { isOpenAt, toJST } from '../utils/openStatus';
import { haversine } from '../utils/distance';
import { fetchShops, fetchCategories } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import type { Category } from '../lib/api';

interface UserLocation {
  lat: number;
  lng: number;
}

export function App() {
  const { user, signInWithGoogle, signOut } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Load data from Supabase
  useEffect(() => {
    Promise.all([fetchShops(), fetchCategories()])
      .then(([s, c]) => {
        setShops(s);
        setCategories(c);
        // Resolve hash after categories are loaded
        const hash = window.location.hash.replace('#', '');
        const matched = c.find((cat) => cat.slug === hash);
        if (matched) setActiveCategory(matched.name);
      })
      .catch((err) => console.error('Failed to load data:', err))
      .finally(() => setLoading(false));
  }, []);

  // Handle hash changes
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (!hash) { setActiveCategory(null); return; }
      const matched = categories.find((c) => c.slug === hash);
      setActiveCategory(matched?.name || null);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [categories]);

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

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of shops) {
      for (const cat of s.categories) {
        map[cat] = (map[cat] || 0) + 1;
      }
    }
    return map;
  }, [shops]);

  const jst = useMemo(() => toJST(checkTime), [checkTime]);

  const openStatusMap = useMemo(() => {
    const map = new Map<number, boolean | null>();
    for (const s of shops) {
      map.set(s.id, isOpenAt(s.hours, jst));
    }
    return map;
  }, [shops, jst]);

  const distanceMap = useMemo(() => {
    const map = new Map<number, number>();
    if (!userLocation) return map;
    for (const s of shops) {
      if (s.lat && s.lng) {
        map.set(s.id, haversine(userLocation.lat, userLocation.lng, s.lat, s.lng));
      }
    }
    return map;
  }, [shops, userLocation]);

  const filtered = useMemo(() => {
    let result = shops;
    if (activeCategory) {
      result = result.filter((s) => s.categories.includes(activeCategory));
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
  }, [shops, activeCategory, showOnlyOpen, openStatusMap, sortByDistance, userLocation, distanceMap]);

  const openCount = useMemo(() => {
    const currentFiltered = activeCategory
      ? shops.filter((s) => s.categories.includes(activeCategory))
      : shops;
    return currentFiltered.filter((s) => openStatusMap.get(s.id) === true).length;
  }, [shops, activeCategory, openStatusMap]);

  const handleTimeChange = useCallback((d: Date) => setCheckTime(d), []);
  const handleToggleFilter = persistShowOnlyOpen;

  const handleLocate = useCallback(() => {
    if (userLocation) {
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
      () => { setLocating(false); alert('定位失敗，請確認已開啟定位服務'); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [userLocation]);

  const handleSelectCategory = useCallback((key: string | null) => {
    const slug = key ? categories.find((c) => c.name === key)?.slug || '' : '';
    window.location.hash = slug;
    setActiveCategory(key);
    window.scrollTo({ top: 0 });
  }, [categories]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">載入中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              東京專門店地圖
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              98 個領域 · {shops.length} 間店
            </p>
          </div>
          <UserMenu user={user} onSignIn={signInWithGoogle} onSignOut={signOut} />
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
        onSelect={handleSelectCategory}
        counts={counts}
        viewMode={viewMode}
        onViewModeChange={persistViewMode}
        categories={categories}
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
