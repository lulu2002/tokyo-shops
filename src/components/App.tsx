import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Shop } from '../types/shop';
import type { List } from '../types/list';
import { CategoryTabs } from './CategoryTabs';
import { ShopGrid } from './ShopGrid';
import { ShopDetail } from './ShopDetail';
import { TimeBar } from './TimeBar';
import { UserMenu } from './UserMenu';
import { ListDrawer } from './ListDrawer';
import { ListTagBar } from './ListTagBar';
import { ImportModal } from './ImportModal';
import { ListPicker } from './ListPicker';
import { MapView } from './MapView';
import { TripPlanner } from './TripPlanner';
import { listTrips, deleteTrip, type SavedTrip } from '../lib/tripStorage';
import { BottomNav } from './BottomNav';
import { TripListView } from './TripListView';
import { isOpenAt, toJST } from '../utils/openStatus';
import { haversine } from '../utils/distance';
import {
  fetchShops, fetchCategories, fetchMyLists, fetchPublicLists, createList, updateList, deleteList,
  fetchListShopIds, addToList, removeFromList, fetchShopListMap,
} from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import type { Category } from '../lib/api';

interface UserLocation {
  lat: number;
  lng: number;
}

export function App() {
  const { user, isAdmin, signInWithGoogle, signOut } = useAuth();
  const [importOpen, setImportOpen] = useState(false);
  const [tripOpen, setTripOpen] = useState(false);
  const [tripSource, setTripSource] = useState<'mobile' | 'desktop'>('desktop');
  const [tripLoadData, setTripLoadData] = useState<SavedTrip | undefined>();
  const [tripListOpen, setTripListOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'explore' | 'map' | 'trip' | 'lists'>('explore');

  // Data
  const [shops, setShops] = useState<Shop[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [checkTime, setCheckTime] = useState(() => new Date());
  const [showOnlyOpen, setShowOnlyOpen] = useState(() => {
    try { return localStorage.getItem('pref:showOnlyOpen') === 'true'; } catch { return false; }
  });
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [sortByDistance, setSortByDistance] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'map'>(() => {
    try { const v = localStorage.getItem('pref:viewMode'); if (v === 'list' || v === 'map') return v; return 'grid'; } catch { return 'grid'; }
  });

  // Lists
  const [myLists, setMyLists] = useState<List[]>([]);
  const [publicLists, setPublicLists] = useState<List[]>([]);
  const [activeListIds, setActiveListIds] = useState<string[]>([]);
  // shopId -> [{ listId, listName }] for all selected lists
  const [selectedListShopMap, setSelectedListShopMap] = useState<Map<number, { listId: string; listName: string }[]>>(new Map());
  const [shopListMap, setShopListMap] = useState<Map<number, { listId: string; listName: string }[]>>(new Map());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pickerShopId, setPickerShopId] = useState<number | null>(null);

  const parseHash = useCallback((hash: string, cats: Category[]) => {
    if (!hash) { setActiveCategory(null); setActiveListIds([]); return; }
    if (hash.startsWith('list:')) {
      setActiveListIds(hash.slice(5).split(',').filter(Boolean));
      return;
    }
    const matched = cats.find((c) => c.slug === hash);
    if (matched) { setActiveCategory(matched.name); setActiveListIds([]); }
  }, []);

  // Load shops + categories + public lists
  useEffect(() => {
    Promise.all([fetchShops(), fetchCategories(), fetchPublicLists()])
      .then(([s, c, pl]) => {
        setShops(s);
        setCategories(c);
        setPublicLists(pl);
        parseHash(window.location.hash.replace('#', ''), c);
      })
      .catch((err) => console.error('Failed to load:', err))
      .finally(() => setLoading(false));
  }, [parseHash]);

  // Load user lists when logged in
  useEffect(() => {
    if (!user) { setMyLists([]); setShopListMap(new Map()); return; }
    fetchMyLists(user.id).then(setMyLists).catch(console.error);
    fetchShopListMap(user.id).then(setShopListMap).catch(console.error);
  }, [user]);

  // Load shop IDs for all selected lists
  useEffect(() => {
    if (activeListIds.length === 0) { setSelectedListShopMap(new Map()); return; }
    const allLists = [...myLists, ...publicLists];
    Promise.all(
      activeListIds.map(async (listId) => {
        const ids = await fetchListShopIds(listId);
        const list = allLists.find((l) => l.id === listId);
        const name = list?.name || '清單';
        return { listId, name, shopIds: ids };
      })
    ).then((results) => {
      const map = new Map<number, { listId: string; listName: string }[]>();
      for (const { listId, name, shopIds } of results) {
        for (const shopId of shopIds) {
          if (!map.has(shopId)) map.set(shopId, []);
          map.get(shopId)!.push({ listId, listName: name });
        }
      }
      setSelectedListShopMap(map);
    }).catch(console.error);
  }, [activeListIds, myLists, publicLists]);

  // Hash change
  useEffect(() => {
    const onHashChange = () => {
      parseHash(window.location.hash.replace('#', ''), categories);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [categories, parseHash]);

  const persistViewMode = useCallback((mode: 'grid' | 'list' | 'map') => {
    setViewMode(mode);
    try { localStorage.setItem('pref:viewMode', mode); } catch {}
  }, []);

  const persistShowOnlyOpen = useCallback(() => {
    setShowOnlyOpen((v) => {
      try { localStorage.setItem('pref:showOnlyOpen', String(!v)); } catch {}
      return !v;
    });
  }, []);

  // List operations
  const handleCreateList = useCallback(async (name: string) => {
    if (!user) return;
    const list = await createList(user.id, name);
    setMyLists((prev) => [...prev, list]);
  }, [user]);

  const handleDeleteList = useCallback(async (listId: string) => {
    await deleteList(listId);
    setMyLists((prev) => prev.filter((l) => l.id !== listId));
    setActiveListIds((prev) => {
      const next = prev.filter((id) => id !== listId);
      if (next.length === 0) window.location.hash = '';
      else window.location.hash = `list:${next.join(',')}`;
      return next;
    });
  }, []);

  const handleTogglePublic = useCallback(async (listId: string, isPublic: boolean) => {
    await updateList(listId, { is_public: isPublic });
    setMyLists((prev) => prev.map((l) => l.id === listId ? { ...l, isPublic } : l));
  }, []);

  const handleToggleList = useCallback((listId: string) => {
    setActiveListIds((prev) => {
      const next = prev.includes(listId) ? prev.filter((id) => id !== listId) : [...prev, listId];
      window.location.hash = next.length > 0 ? `list:${next.join(',')}` : '';
      return next;
    });
  }, []);


  const handleToggleListItem = useCallback(async (listId: string, add: boolean) => {
    if (!pickerShopId || !user) return;
    if (add) {
      await addToList(listId, pickerShopId);
    } else {
      await removeFromList(listId, pickerShopId);
    }
    // Refresh
    fetchMyLists(user.id).then(setMyLists);
    fetchShopListMap(user.id).then(setShopListMap);
    // Trigger re-fetch of selected lists
    setActiveListIds((prev) => [...prev]);
  }, [pickerShopId, user]);

  const handleHeartClick = useCallback(() => {
    if (!selectedShop) return;
    setPickerShopId(selectedShop.id);
  }, [selectedShop]);

  const handleHeartFromList = useCallback((shop: Shop) => {
    setPickerShopId(shop.id);
  }, []);

  const shopInListSet = useMemo(() => {
    return new Set(shopListMap.keys());
  }, [shopListMap]);

  // Computed — counts reflect active list filter
  const listFilterActive = activeListIds.length > 0;
  const baseShops = useMemo(() => {
    return listFilterActive ? shops.filter((s) => selectedListShopMap.has(s.id)) : shops;
  }, [shops, listFilterActive, selectedListShopMap]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of baseShops) {
      for (const cat of s.categories) {
        map[cat] = (map[cat] || 0) + 1;
      }
    }
    return map;
  }, [baseShops]);

  const jst = useMemo(() => toJST(checkTime), [checkTime]);

  const openStatusMap = useMemo(() => {
    const map = new Map<number, boolean | null>();
    for (const s of shops) map.set(s.id, isOpenAt(s.hours, jst));
    return map;
  }, [shops, jst]);

  const distanceMap = useMemo(() => {
    const map = new Map<number, number>();
    if (!userLocation) return map;
    for (const s of shops) {
      if (s.lat && s.lng) map.set(s.id, haversine(userLocation.lat, userLocation.lng, s.lat, s.lng));
    }
    return map;
  }, [shops, userLocation]);

  const filtered = useMemo(() => {
    let result = baseShops;
    if (activeCategory) {
      result = result.filter((s) => s.categories.includes(activeCategory));
    }
    if (showOnlyOpen) {
      result = result.filter((s) => openStatusMap.get(s.id) === true);
    }
    result = [...result];
    if (sortByDistance && userLocation) {
      result.sort((a, b) => (distanceMap.get(a.id) ?? Infinity) - (distanceMap.get(b.id) ?? Infinity));
    } else if (listFilterActive && activeListIds.length > 1) {
      // Sort by overlap: shops in more selected lists first
      result.sort((a, b) => {
        const aCount = selectedListShopMap.get(a.id)?.length || 0;
        const bCount = selectedListShopMap.get(b.id)?.length || 0;
        return bCount - aCount;
      });
    }
    return result;
  }, [baseShops, activeCategory, showOnlyOpen, openStatusMap, sortByDistance, userLocation, distanceMap, listFilterActive, activeListIds, selectedListShopMap]);

  const openCount = useMemo(() => {
    const scope = activeCategory
      ? baseShops.filter((s) => s.categories.includes(activeCategory))
      : baseShops;
    return scope.filter((s) => openStatusMap.get(s.id) === true).length;
  }, [baseShops, activeCategory, openStatusMap]);

  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.name, c.id]));
  }, [categories]);

  const handleImportDone = useCallback(() => {
    setImportOpen(false);
    // Reload shops
    fetchShops().then(setShops);
  }, []);

  const handleTimeChange = useCallback((d: Date) => setCheckTime(d), []);

  const handleLocate = useCallback(() => {
    if (userLocation) { setUserLocation(null); setSortByDistance(false); return; }
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setSortByDistance(true); setLocating(false); },
      () => { setLocating(false); alert('定位失敗，請確認已開啟定位服務'); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [userLocation]);

  const handleSelectCategory = useCallback((key: string | null) => {
    setActiveCategory(key);
    // Only update hash if not in list mode
    if (!listFilterActive) {
      const slug = key ? categories.find((c) => c.name === key)?.slug || '' : '';
      window.location.hash = slug;
    }
    window.scrollTo({ top: 0 });
  }, [categories, listFilterActive]);

  // Determine effective view for mobile (bottom nav controls view)
  const isMobileMap = mobileTab === 'map';
  const isMobileTrip = mobileTab === 'trip';
  const isMobileLists = mobileTab === 'lists';

  const handleMobileTab = useCallback((tab: 'explore' | 'map' | 'trip' | 'lists') => {
    setMobileTab(tab);
    if (tab === 'map') {
      persistViewMode('map');
    } else if (tab === 'explore') {
      // Always reset to grid/list when going to explore (not map)
      if (viewMode === 'map') persistViewMode('grid');
    } else if (tab === 'lists') {
      setDrawerOpen(true);
    }
  }, [viewMode, persistViewMode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">載入中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-14 sm:pb-0">
      {/* Header */}
      <header className={`bg-white border-b border-gray-200 ${isMobileTrip ? 'mobile-hidden' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-6 flex items-center sm:items-start justify-between">
          <div>
            <h1 className="text-lg sm:text-3xl font-bold text-gray-900">東京專門店地圖</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1 hidden sm:block">98 個領域 · {shops.length} 間店</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Desktop: trip dropdown */}
            <div className="relative hidden sm:block">
              <button
                onClick={() => setTripListOpen(v => !v)}
                className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-sm font-medium hover:bg-emerald-100 transition-colors"
              >
                規劃行程
              </button>
              {tripListOpen && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
                  <button
                    onClick={() => { setTripLoadData(undefined); setTripOpen(true); setTripSource('desktop'); setTripListOpen(false); }}
                    className="w-full px-4 py-3 text-left text-sm font-medium text-emerald-600 hover:bg-emerald-50 border-b border-gray-100"
                  >
                    + 新行程
                  </button>
                  {listTrips().length > 0 && (
                    <div className="max-h-48 overflow-y-auto">
                      {listTrips().map(trip => (
                        <div key={trip.id} className="flex items-center hover:bg-gray-50">
                          <button
                            onClick={() => { setTripLoadData(trip); setTripOpen(true); setTripSource('desktop'); setTripListOpen(false); }}
                            className="flex-1 px-4 py-2.5 text-left"
                          >
                            <div className="text-sm font-medium text-gray-800">{trip.name}</div>
                            <div className="text-xs text-gray-400">{trip.shopIds.length} 間店</div>
                          </button>
                          <button
                            onClick={() => { deleteTrip(trip.id); setTripListOpen(v => !v); setTimeout(() => setTripListOpen(v => !v), 0); }}
                            className="px-3 py-2 text-gray-300 hover:text-red-400 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            {isAdmin && (
              <button
                onClick={() => setImportOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-sm font-medium hover:bg-blue-100 transition-colors"
              >
                + 匯入
              </button>
            )}
            <UserMenu user={user} onSignIn={signInWithGoogle} onSignOut={signOut} onOpenLists={() => setDrawerOpen(true)} hasPublicLists={publicLists.length > 0} />
          </div>
        </div>
      </header>

      {/* TimeBar */}
      <div className={(isMobileMap || isMobileTrip) ? 'mobile-hidden' : ''}>
        <TimeBar
          checkTime={checkTime}
          onTimeChange={handleTimeChange}
          openCount={openCount}
          totalCount={filtered.length}
          showOnlyOpen={showOnlyOpen}
          onToggleFilter={persistShowOnlyOpen}
          userLocation={userLocation}
          locating={locating}
          sortByDistance={sortByDistance}
          onLocate={handleLocate}
          onToggleSortDistance={() => setSortByDistance((v) => !v)}
        />
      </div>

      {/* ListTagBar — hide on mobile in map/trip/lists mode */}
      {(user || publicLists.length > 0) && (
        <div className={(isMobileMap || isMobileTrip || isMobileLists) ? 'mobile-hidden' : ''}>
          <ListTagBar
            activeListIds={activeListIds}
            allLists={[...myLists, ...publicLists]}
            onToggleList={handleToggleList}
            onOpenDrawer={() => setDrawerOpen(true)}
          />
        </div>
      )}

      {/* CategoryTabs */}
      <div className={(isMobileMap || isMobileTrip) ? 'mobile-hidden' : ''}>
        <CategoryTabs
          activeCategory={activeCategory}
          onSelect={handleSelectCategory}
          counts={counts}
          viewMode={viewMode}
          onViewModeChange={persistViewMode}
          categories={categories}
        />
      </div>

      {/* Main content — explore/map */}
      <main className={`${viewMode === 'map' ? '' : 'max-w-7xl mx-auto'} ${isMobileTrip ? 'mobile-hidden' : ''}`}>
        {viewMode === 'map' ? (
          <MapView
            shops={filtered}
            onSelect={setSelectedShop}
            openStatusMap={openStatusMap}
            distanceMap={distanceMap}
            isAdmin={isAdmin}
            categoryMap={categoryMap}
            onImportDone={handleImportDone}
          />
        ) : (
          <ShopGrid
            shops={filtered}
            onSelect={setSelectedShop}
            openStatusMap={openStatusMap}
            distanceMap={distanceMap}
            viewMode={viewMode}
            shopInListSet={user ? shopInListSet : undefined}
            onHeart={user ? handleHeartFromList : undefined}
            shopListTags={listFilterActive ? selectedListShopMap : undefined}
          />
        )}
      </main>

      {/* Mobile trip tab: list view (when no trip open) */}
      <div className="sm:!hidden" style={{ display: isMobileTrip && !tripOpen ? '' : 'none' }}>
        <div className="max-w-lg mx-auto">
          <TripListView
            onSelectTrip={(trip) => { setTripLoadData(trip); setTripOpen(true); setTripSource('mobile'); }}
            onNewTrip={() => { setTripLoadData(undefined); setTripOpen(true); setTripSource('mobile'); }}
          />
        </div>
      </div>

      {/* Mobile trip tab: planner (stays mounted, hidden via display) */}
      <div className="sm:!hidden" style={{ display: isMobileTrip && tripOpen ? '' : 'none' }}>
        <TripPlanner
          key={`mobile-${tripLoadData?.id ?? 'new'}`}
          shops={shops}
          categories={categories}
          onClose={() => { setTripOpen(false); setTripLoadData(undefined); }}
          loadTrip={tripLoadData}
          inline
        />
      </div>

      {/* Bottom Nav — mobile only */}
      <BottomNav
        active={mobileTab}
        onChange={handleMobileTab}
        tripCount={listTrips().length}
        listCount={myLists.length}
      />

      {selectedShop && (
        <ShopDetail
          shop={selectedShop}
          onClose={() => setSelectedShop(null)}
          isOpen={openStatusMap.get(selectedShop.id) ?? null}
          distance={distanceMap.get(selectedShop.id)}
          isLoggedIn={!!user}
          inListIds={(shopListMap.get(selectedShop.id) || []).map((x) => x.listId)}
          onHeartClick={handleHeartClick}
        />
      )}

      {drawerOpen && (
        <ListDrawer
          lists={myLists}
          publicLists={publicLists.filter((pl) => !myLists.some((ml) => ml.id === pl.id))}
          activeListIds={activeListIds}
          onToggleList={handleToggleList}
          onCreate={handleCreateList}
          onDelete={handleDeleteList}
          onTogglePublic={handleTogglePublic}
          onClose={() => setDrawerOpen(false)}
          loggedIn={!!user}
          onSignIn={signInWithGoogle}
        />
      )}

      {pickerShopId !== null && (
        <ListPicker
          lists={myLists}
          shopInLists={(shopListMap.get(pickerShopId) || []).map((x) => x.listId)}
          onToggle={handleToggleListItem}
          onCreate={handleCreateList}
          onClose={() => setPickerShopId(null)}
        />
      )}

      {/* Desktop-only trip planner overlay */}
      {tripOpen && tripSource === 'desktop' && (
        <TripPlanner
          key={`desktop-${tripLoadData?.id ?? 'new'}`}
          shops={shops}
          categories={categories}
          onClose={() => { setTripOpen(false); setTripLoadData(undefined); }}
          loadTrip={tripLoadData}
        />
      )}

      {importOpen && (
        <ImportModal
          categories={categories}
          categoryMap={categoryMap}
          onClose={() => setImportOpen(false)}
          onDone={handleImportDone}
        />
      )}
    </div>
  );
}
