import { useState, useEffect } from 'react';
import { toJST } from '../utils/openStatus';

interface UserLocation {
  lat: number;
  lng: number;
}

interface Props {
  checkTime: Date;
  onTimeChange: (date: Date) => void;
  openCount: number;
  totalCount: number;
  showOnlyOpen: boolean;
  onToggleFilter: () => void;
  userLocation: UserLocation | null;
  locating: boolean;
  sortByDistance: boolean;
  onLocate: () => void;
  onToggleSortDistance: () => void;
}

export function TimeBar({
  checkTime, onTimeChange, openCount, totalCount,
  showOnlyOpen, onToggleFilter,
  userLocation, locating, sortByDistance, onLocate, onToggleSortDistance,
}: Props) {
  const [useNow, setUseNow] = useState(true);
  const jst = toJST(checkTime);

  useEffect(() => {
    if (!useNow) return;
    const id = setInterval(() => onTimeChange(new Date()), 60000);
    return () => clearInterval(id);
  }, [useNow, onTimeChange]);

  const handleDateTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;
    const [datePart, timePart] = val.split('T');
    const [y, m, d] = datePart.split('-').map(Number);
    const [h, min] = timePart.split(':').map(Number);
    const utcMs = Date.UTC(y, m - 1, d, h - 9, min);
    onTimeChange(new Date(utcMs));
    setUseNow(false);
  };

  const handleNow = () => {
    setUseNow(true);
    onTimeChange(new Date());
  };

  const dtValue = `${jst.getFullYear()}-${String(jst.getMonth() + 1).padStart(2, '0')}-${String(jst.getDate()).padStart(2, '0')}T${String(jst.getHours()).padStart(2, '0')}:${String(jst.getMinutes()).padStart(2, '0')}`;

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center gap-2 flex-wrap text-sm">
        {/* Time controls */}
        <span className="text-gray-500 shrink-0">🕐</span>
        <button
          onClick={handleNow}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            useNow ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          現在
        </button>
        <input
          type="datetime-local"
          value={dtValue}
          onChange={handleDateTimeChange}
          className={`px-2 py-1 rounded-lg border text-sm w-[180px] ${
            useNow ? 'border-gray-200 text-gray-400' : 'border-blue-300 text-gray-700 bg-blue-50'
          }`}
        />

        {/* Divider */}
        <span className="text-gray-200 hidden sm:inline">|</span>

        {/* Location */}
        <button
          onClick={onLocate}
          disabled={locating}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            userLocation
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          } ${locating ? 'animate-pulse' : ''}`}
        >
          {locating ? '定位中...' : userLocation ? '📍 已定位' : '📍 附近'}
        </button>

        {userLocation && (
          <button
            onClick={onToggleSortDistance}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              sortByDistance
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {sortByDistance ? '依距離排序中' : '依距離排序'}
          </button>
        )}

        {/* Right side: counts + filter */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-green-600 font-medium">{openCount} 間營業中</span>
          <span className="text-gray-400">/ {totalCount}</span>
          <button
            onClick={onToggleFilter}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              showOnlyOpen
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {showOnlyOpen ? '只看營業中' : '顯示全部'}
          </button>
        </div>
      </div>
    </div>
  );
}
