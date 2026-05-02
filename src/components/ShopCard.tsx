import type { Shop } from '../types/shop';
import { CATEGORIES } from '../constants/categories';
import { formatDistanceLabel } from '../utils/distance';
import { PhotoCarousel } from './PhotoCarousel';
import { useInView } from '../hooks/useInView';

interface Props {
  shop: Shop;
  onSelect: (shop: Shop) => void;
  isOpen: boolean | null;
  distance?: number;
}

export function ShopCard({ shop, onSelect, isOpen, distance }: Props) {
  const catColor = CATEGORIES.find((c) => c.key === shop.category)?.color || 'bg-gray-500';
  const photos = shop.photos?.length ? shop.photos : shop.photoUrl ? [shop.photoUrl] : [];
  const { ref, inView } = useInView('300px');

  return (
    <div
      ref={ref}
      onClick={() => onSelect(shop)}
      className="group text-left bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-gray-100 cursor-pointer"
    >
      <div className="relative">
        {inView ? (
          <PhotoCarousel photos={photos} alt={shop.name} aspect="aspect-[16/10]" />
        ) : (
          <div className="aspect-[16/10] bg-gray-100" />
        )}
        <span className={`absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full text-xs font-medium text-white ${catColor}`}>
          {shop.subcategory}
        </span>
        <div className="absolute top-2 right-2 z-10 flex gap-1">
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
