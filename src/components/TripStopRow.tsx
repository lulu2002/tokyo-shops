import { useState } from 'react';
import type { TripStop, StopTimeline } from '../types/trip';
import { estimateWalkMinutes } from '../utils/distance';

const DURATION_OPTIONS = [0, 15, 30, 45, 60, 90, 120, 180, 240, 300, 360];

interface Props {
  stop: TripStop;
  onRemove?: () => void;
  onToggleVisited?: () => void;
  onDurationChange?: (duration: number) => void;
  onSelect?: () => void;
  aiNote?: string;
  duration?: number;
  stopTimeline?: StopTimeline;
  distance?: number;
}

export function TripStopRow({ stop, onRemove, onToggleVisited, onDurationChange, onSelect, aiNote, duration, stopTimeline, distance }: Props) {
  const { shop, openWindow, closed, visited } = stop;
  const dimmed = closed || visited;
  const [durationOpen, setDurationOpen] = useState(false);
  const currentDuration = duration ?? shop.visitDuration ?? 20;

  const isClosed = stopTimeline?.willBeClosed && !closed;
  const isUrgent = stopTimeline && !stopTimeline.willBeClosed && stopTimeline.minutesUntilClose <= 60 && stopTimeline.minutesUntilClose > 0;

  return (
    <div className={`px-3 py-2 ${dimmed ? 'opacity-40' : ''} ${isClosed ? 'bg-red-50' : ''}`}>
      <div className="flex items-center gap-2">
        {/* Estimated arrival */}
        {stopTimeline && !dimmed && (
          <span className={`shrink-0 text-xs font-mono w-10 ${isClosed ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
            {stopTimeline.arrivalStr}
          </span>
        )}

        {/* Photo + Info (clickable) */}
        <button
          onClick={onSelect}
          className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-75 transition-opacity"
          disabled={!onSelect}
        >
          <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-gray-100">
            {shop.photoUrl && (
              <img src={shop.photoUrl} className="w-full h-full object-cover" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-medium truncate ${closed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
              {shop.name}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              {shop.subcategory && <span>{shop.subcategory}</span>}
              {!onRemove && currentDuration > 0 && (
                <span className="text-gray-400">· 停留 {currentDuration >= 60 ? `${currentDuration / 60} 小時` : `${currentDuration} 分`}</span>
              )}
              {distance !== undefined && distance < 5000 && (
                <span className="text-blue-500">· 步行 {estimateWalkMinutes(distance)} 分</span>
              )}
            </div>
          </div>
        </button>

        {/* Duration picker */}
        {onDurationChange && !dimmed && (
          <div className="relative shrink-0">
            <button
              onClick={() => setDurationOpen(v => !v)}
              className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 font-mono"
            >
              {currentDuration === 0 ? '跳過' : currentDuration >= 60 ? `${currentDuration / 60}h` : `${currentDuration}分`}
            </button>
            {durationOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-20 overflow-hidden">
                {DURATION_OPTIONS.map(d => (
                  <button
                    key={d}
                    onClick={() => { onDurationChange(d); setDurationOpen(false); }}
                    className={`block w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 ${d === currentDuration ? 'text-blue-600 font-semibold' : 'text-gray-600'}`}
                  >
                    {d === 0 ? '跳過（不佔時間）' : d >= 60 ? `${d / 60} 小時` : `${d} 分`}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Status badge */}
        <div className="shrink-0">
          {closed ? (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 font-medium">公休</span>
          ) : isClosed ? (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">已關</span>
          ) : isUrgent ? (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">
              剩{stopTimeline.minutesUntilClose}分
            </span>
          ) : openWindow ? (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
              openWindow.close <= 17 * 60 || openWindow.open >= 12 * 60
                ? 'bg-amber-50 text-amber-600'
                : 'bg-green-50 text-green-600'
            }`}>
              {openWindow.openStr}～{openWindow.closeStr}
            </span>
          ) : (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-400">不明</span>
          )}
        </div>

        {/* Visited toggle */}
        {onToggleVisited && (
          <button
            onClick={onToggleVisited}
            className={`shrink-0 w-6 h-6 flex items-center justify-center text-sm transition-colors ${
              visited ? 'text-green-500' : 'text-gray-300 hover:text-green-400'
            }`}
          >
            {visited ? '✓' : '○'}
          </button>
        )}

        {/* Remove */}
        {onRemove && (
          <button
            onClick={onRemove}
            className="shrink-0 w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* AI note */}
      {aiNote && !dimmed && (
        <div className={`${stopTimeline ? 'ml-22' : 'ml-12'} mt-1 text-xs text-indigo-500 flex items-center gap-1`}>
          <span>💡</span> {aiNote}
        </div>
      )}
    </div>
  );
}
