import type { Shop } from '../types/shop';
import { formatDistance, estimateWalkMinutes } from '../utils/distance';

interface Props {
  shop: Shop;
  onSelect: (shop: Shop) => void;
  isOpen: boolean | null;
  distance?: number;
  inList?: boolean;
  onHeart?: (shop: Shop) => void;
}

export function ShopListItem({ shop, onSelect, isOpen, distance, inList, onHeart }: Props) {
  const catColor = shop.categoryColor;
  return (
    <button
      onClick={() => onSelect(shop)}
      className="flex gap-3 w-full text-left p-3 bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors"
    >
      {/* Thumbnail */}
      <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-gray-100">
        {shop.photoUrl ? (
          <img
            src={shop.photoUrl}
            alt={shop.name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
            <span className="text-lg opacity-30">🏪</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <h3 className="font-semibold text-gray-900 text-sm truncate">{shop.name}</h3>
          {shop.rating ? (
            <span className="text-xs text-gray-400 shrink-0">★ {shop.rating}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 mb-1">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium text-white leading-none ${catColor}`}>
            {shop.subcategory}
          </span>
          {shop.specialty && (
            <span className="text-xs text-gray-400 truncate">{shop.specialty}</span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            📍 {shop.location}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {distance !== undefined && (
              <span className="text-xs font-medium text-blue-600">
                {formatDistance(distance)}
                {estimateWalkMinutes(distance) <= 30 ? ` · ${estimateWalkMinutes(distance)}分` : ''}
              </span>
            )}
            {isOpen === true && (
              <span className="w-2 h-2 rounded-full bg-green-500" title="營業中" />
            )}
            {isOpen === false && (
              <span className="text-[10px] text-gray-400">休</span>
            )}
            {onHeart && (
              <button
                onClick={(e) => { e.stopPropagation(); onHeart(shop); }}
                className="text-sm"
              >
                {inList ? '❤️' : '🤍'}
              </button>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
