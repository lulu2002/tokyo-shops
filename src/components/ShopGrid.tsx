import type { Shop } from '../types/shop';
import { ShopCard } from './ShopCard';
import { ShopListItem } from './ShopListItem';

interface Props {
  shops: Shop[];
  onSelect: (shop: Shop) => void;
  openStatusMap: Map<number, boolean | null>;
  distanceMap: Map<number, number>;
  viewMode: 'grid' | 'list';
}

export function ShopGrid({ shops, onSelect, openStatusMap, distanceMap, viewMode }: Props) {
  if (shops.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <p>沒有符合的店家</p>
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div className="bg-white rounded-xl mx-4 my-4 overflow-hidden shadow-sm border border-gray-100">
        {shops.map((shop) => (
          <ShopListItem
            key={shop.id}
            shop={shop}
            onSelect={onSelect}
            isOpen={openStatusMap.get(shop.id) ?? null}
            distance={distanceMap.get(shop.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
      {shops.map((shop) => (
        <ShopCard
          key={shop.id}
          shop={shop}
          onSelect={onSelect}
          isOpen={openStatusMap.get(shop.id) ?? null}
          distance={distanceMap.get(shop.id)}
        />
      ))}
    </div>
  );
}
