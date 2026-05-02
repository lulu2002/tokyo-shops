import type { Shop } from '../types/shop';
import { CATEGORIES } from '../constants/categories';
import { formatDistanceLabel } from '../utils/distance';

interface Props {
  shop: Shop;
  onSelect: (shop: Shop) => void;
  isOpen: boolean | null;
  distance?: number;
}

export function ShopCard({ shop, onSelect, isOpen, distance }: Props) {
  const catColor = CATEGORIES.find((c) => c.key === shop.category)?.color || 'bg-gray-500';

  return (
    <div
      onClick={() => onSelect(shop)}
      className="group text-left bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-gray-100 cursor-pointer"
    >
      <div className="aspect-[16/10] bg-gray-100 overflow-hidden relative">
        {shop.photoUrl ? (
          <img
            src={shop.photoUrl}
            alt={shop.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
            <span className="text-4xl opacity-30">🏪</span>
          </div>
        )}
        <span
          className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium text-white ${catColor}`}
        >
          {shop.subcategory}
        </span>
        <div className="absolute top-2 right-2 flex gap-1">
          {shop.rating ? (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/90 text-gray-700">
              ★ {shop.rating}
            </span>
          ) : null}
          {isOpen === true && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500 text-white">
              營業中
            </span>
          )}
          {isOpen === false && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500 text-white">
              休
            </span>
          )}
        </div>
        {shop.photos && shop.photos.length > 1 && (
          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/40 text-white">
            📷 {shop.photos.length}
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-gray-900 text-base leading-snug">
          {shop.name}
        </h3>
        {shop.specialty && (
          <p className="text-sm text-gray-500 mt-1 line-clamp-1">{shop.specialty}</p>
        )}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>📍 {shop.location}</span>
          </div>
          {distance !== undefined && (
            <span className="text-xs font-medium text-blue-600 shrink-0">
              {formatDistanceLabel(distance)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
