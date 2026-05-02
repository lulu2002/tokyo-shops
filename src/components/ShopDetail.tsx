import { useEffect } from 'react';
import type { Shop } from '../types/shop';
import { formatDistanceLabel } from '../utils/distance';
import { PhotoCarousel } from './PhotoCarousel';

interface Props {
  shop: Shop;
  onClose: () => void;
  isOpen: boolean | null;
  distance?: number;
  isLoggedIn: boolean;
  inListIds: string[];
  onHeartClick: () => void;
}

export function ShopDetail({ shop, onClose, isOpen, distance, isLoggedIn, inListIds, onHeartClick }: Props) {
  const catColor = shop.categoryColor;
  const mapsUrl = shop.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${shop.lat},${shop.lng}`;
  const summaryText = shop.description || '';
  const photos = shop.photos?.length ? shop.photos : shop.photoUrl ? [shop.photoUrl] : [];

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white w-full sm:max-w-lg sm:rounded-xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50 transition-colors"
        >
          ✕
        </button>

        <PhotoCarousel photos={photos} alt={shop.name} />

        <div className="p-5">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${catColor}`}>
              {shop.subcategory}
            </span>
            {isOpen === true && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500 text-white">營業中</span>
            )}
            {isOpen === false && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-400 text-white">目前未營業</span>
            )}
            {shop.rating ? (
              <span className="text-sm text-gray-500">
                ★ {shop.rating}
                {shop.reviewCount ? ` (${shop.reviewCount})` : ''}
              </span>
            ) : null}
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-1">{shop.name}</h2>

          {shop.specialty && (
            <p className="text-base text-gray-600 mb-3">{shop.specialty}</p>
          )}

          {summaryText && (
            <p className="text-sm text-gray-500 leading-relaxed mb-4">{summaryText}</p>
          )}

          <div className="space-y-2 text-sm text-gray-600 mb-4">
            {distance !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-gray-400 w-5 shrink-0">🚶</span>
                <span className="font-medium text-blue-600">{formatDistanceLabel(distance)}</span>
              </div>
            )}
            {shop.address && (
              <div className="flex gap-2">
                <span className="text-gray-400 w-5 shrink-0">📍</span>
                <span>{shop.address}</span>
              </div>
            )}
            {!shop.address && shop.location && (
              <div className="flex items-center gap-2">
                <span className="text-gray-400 w-5">📍</span>
                <span>{shop.location}</span>
              </div>
            )}
            {shop.price && (
              <div className="flex items-center gap-2">
                <span className="text-gray-400 w-5">💰</span>
                <span>{shop.price}</span>
              </div>
            )}
            {shop.hours && shop.hours.length > 0 && (
              <details className="group">
                <summary className="flex items-center gap-2 cursor-pointer list-none">
                  <span className="text-gray-400 w-5">🕐</span>
                  <span>{shop.hours[0]}</span>
                  <span className="text-xs text-gray-400 group-open:hidden">...展開</span>
                </summary>
                <div className="ml-7 mt-1 space-y-0.5 text-xs text-gray-500">
                  {shop.hours.slice(1).map((h, i) => (
                    <div key={i}>{h}</div>
                  ))}
                </div>
              </details>
            )}
          </div>

          <div className="flex gap-2">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
            >
              Google Maps →
            </a>
            {shop.website && (
              <a
                href={shop.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center py-3 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
              >
                官方網站 →
              </a>
            )}
            {isLoggedIn && (
              <button
                onClick={onHeartClick}
                className={`w-12 shrink-0 py-3 rounded-lg text-lg transition-colors ${
                  inListIds.length > 0
                    ? 'bg-rose-500 text-white'
                    : 'bg-gray-100 text-gray-400 hover:bg-rose-50 hover:text-rose-500'
                }`}
              >
                {inListIds.length > 0 ? '❤️' : '🤍'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
