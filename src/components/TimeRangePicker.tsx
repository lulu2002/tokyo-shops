import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  startTime: string;
  endTime: string;
  onChange: (start: string, end: string) => void;
}

const HOURS = Array.from({ length: 25 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];
const ITEM_H = 36;
const VISIBLE = 5; // show 5 rows, center is selected

function pad(n: number): string { return n.toString().padStart(2, '0'); }

function parseTime(t: string): [number, number] {
  if (!t) return [10, 0];
  const [h, m] = t.split(':').map(Number);
  // Snap minute to nearest 15
  const snapped = MINUTES.reduce((prev, curr) =>
    Math.abs(curr - (m || 0)) < Math.abs(prev - (m || 0)) ? curr : prev
  );
  return [h || 0, snapped];
}

// Scroll wheel column
function WheelColumn({ items, value, onChange, formatFn }: {
  items: number[];
  value: number;
  onChange: (v: number) => void;
  formatFn?: (v: number) => string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);
  const fmt = formatFn || ((v: number) => pad(v));

  const selectedIdx = items.indexOf(value);

  // Scroll to selected on mount and value change
  useEffect(() => {
    if (!containerRef.current || isScrolling.current) return;
    const target = selectedIdx * ITEM_H;
    containerRef.current.scrollTo({ top: target, behavior: 'smooth' });
  }, [selectedIdx]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    isScrolling.current = true;

    // Debounce: detect when scrolling stops
    const el = containerRef.current;
    clearTimeout((el as unknown as Record<string, number>)._scrollTimer);
    (el as unknown as Record<string, number>)._scrollTimer = window.setTimeout(() => {
      isScrolling.current = false;
      const idx = Math.round(el.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      if (items[clamped] !== value) {
        onChange(items[clamped]);
      }
      // Snap to exact position
      el.scrollTo({ top: clamped * ITEM_H, behavior: 'smooth' });
    }, 80);
  }, [items, value, onChange]);

  return (
    <div className="relative" style={{ height: ITEM_H * VISIBLE }}>
      {/* Highlight bar */}
      <div
        className="absolute left-0 right-0 bg-blue-50 border-y border-blue-100 pointer-events-none z-0"
        style={{ top: ITEM_H * Math.floor(VISIBLE / 2), height: ITEM_H }}
      />
      {/* Fade top/bottom */}
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white to-transparent pointer-events-none z-10" />
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none z-10" />
      {/* Scroll container */}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto no-scrollbar relative z-0"
        onScroll={handleScroll}
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {/* Top padding */}
        <div style={{ height: ITEM_H * Math.floor(VISIBLE / 2) }} />
        {items.map(item => (
          <div
            key={item}
            className={`flex items-center justify-center cursor-pointer select-none transition-colors ${
              item === value ? 'text-gray-900 font-semibold text-lg' : 'text-gray-400 text-base'
            }`}
            style={{ height: ITEM_H, scrollSnapAlign: 'center' }}
            onClick={() => {
              onChange(item);
              if (containerRef.current) {
                const idx = items.indexOf(item);
                containerRef.current.scrollTo({ top: idx * ITEM_H, behavior: 'smooth' });
              }
            }}
          >
            {fmt(item)}
          </div>
        ))}
        {/* Bottom padding */}
        <div style={{ height: ITEM_H * Math.floor(VISIBLE / 2) }} />
      </div>
    </div>
  );
}

export function TimeRangePicker({ startTime, endTime, onChange }: Props) {
  const [editing, setEditing] = useState<'start' | 'end' | null>(null);
  const [sh, setSh] = useState(() => parseTime(startTime)[0]);
  const [sm, setSm] = useState(() => parseTime(startTime)[1]);
  const [eh, setEh] = useState(() => parseTime(endTime)[0]);
  const [em, setEm] = useState(() => parseTime(endTime)[1]);

  const startLabel = `${pad(sh)}:${pad(sm)}`;
  const endLabel = `${pad(eh)}:${pad(em)}`;
  const diffMin = (eh * 60 + em) - (sh * 60 + sm);
  const diffLabel = diffMin > 0
    ? `${Math.floor(diffMin / 60)}h${diffMin % 60 ? diffMin % 60 + 'm' : ''}`
    : '';

  const handleConfirm = useCallback(() => {
    const s = `${pad(sh)}:${pad(sm)}`;
    const e = `${pad(eh)}:${pad(em)}`;
    onChange(s, e);
    setEditing(null);
  }, [sh, sm, eh, em, onChange]);

  return (
    <div>
      {/* Compact display */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setEditing('start')}
          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            editing === 'start' ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 bg-gray-50 text-gray-700'
          }`}
        >
          {startLabel}
        </button>
        <span className="text-gray-300">→</span>
        <button
          onClick={() => setEditing('end')}
          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            editing === 'end' ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 bg-gray-50 text-gray-700'
          }`}
        >
          {endLabel}
        </button>
        {diffLabel && <span className="text-xs text-gray-400">{diffLabel}</span>}
      </div>

      {/* Wheel picker */}
      {editing && (
        <div className="mt-2 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              {editing === 'start' ? '開始時間' : '結束時間'}
            </span>
            <span className="text-lg font-semibold text-gray-900">
              {editing === 'start' ? startLabel : endLabel}
            </span>
          </div>

          <div className="flex items-center justify-center px-6 py-2">
            <div className="w-20">
              <WheelColumn
                items={HOURS}
                value={editing === 'start' ? sh : eh}
                onChange={v => editing === 'start' ? setSh(v) : setEh(v)}
              />
            </div>
            <span className="text-xl text-gray-300 mx-2 font-bold">:</span>
            <div className="w-20">
              <WheelColumn
                items={MINUTES}
                value={editing === 'start' ? sm : em}
                onChange={v => editing === 'start' ? setSm(v) : setEm(v)}
              />
            </div>
          </div>

          <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
            <button
              onClick={() => setEditing(null)}
              className="flex-1 py-2 text-sm text-gray-500 bg-gray-50 rounded-lg hover:bg-gray-100"
            >
              取消
            </button>
            <button
              onClick={() => {
                handleConfirm();
                // Auto-open end picker after setting start
                if (editing === 'start') {
                  setTimeout(() => setEditing('end'), 100);
                }
              }}
              className="flex-1 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 font-medium"
            >
              確認
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
