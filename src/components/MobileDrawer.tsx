import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

const SNAP_CLOSED = 0;
const SNAP_PEEK = 40;
const SNAP_FULL = 90;

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function MobileDrawer({ open, onClose, title, children }: Props) {
  const [heightPct, setHeightPct] = useState(SNAP_CLOSED);
  const [visible, setVisible] = useState(false);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const startH = useRef(0);

  // Animate open/close
  useEffect(() => {
    if (open) {
      setVisible(true);
      setHeightPct(SNAP_CLOSED);
      // Wait for mount + paint, then animate up
      const timer = setTimeout(() => setHeightPct(SNAP_PEEK), 50);
      return () => clearTimeout(timer);
    } else if (visible) {
      setHeightPct(SNAP_CLOSED);
      const timer = setTimeout(() => setVisible(false), 350);
      return () => clearTimeout(timer);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setDragging(true);
    startY.current = e.clientY;
    startH.current = heightPct;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [heightPct]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dy = startY.current - e.clientY;
    const dPct = (dy / window.innerHeight) * 100;
    const newH = Math.max(5, Math.min(SNAP_FULL, startH.current + dPct));
    setHeightPct(newH);
  }, [dragging]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
    const snaps = [SNAP_CLOSED, SNAP_PEEK, SNAP_FULL];
    let closest = SNAP_PEEK;
    let minDist = Infinity;
    for (const s of snaps) {
      const d = Math.abs(heightPct - s);
      if (d < minDist) { minDist = d; closest = s; }
    }
    if (closest === SNAP_CLOSED) {
      onClose();
    } else {
      setHeightPct(closest);
    }
  }, [heightPct, onClose]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!visible) return null;

  return (
    <div className="sm:hidden absolute inset-x-0 bottom-0 z-20">
      <div
        className={`bg-white rounded-t-2xl shadow-2xl border-t border-gray-200 flex flex-col ${
          dragging ? '' : 'transition-[height] duration-300 ease-out'
        }`}
        style={{ height: heightPct > 0 ? `${heightPct}vh` : '0vh' }}
      >
        {/* Drag handle */}
        <div
          className="shrink-0 pt-2.5 pb-1 flex flex-col items-center cursor-grab active:cursor-grabbing touch-none select-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="shrink-0 px-4 pb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">{title}</span>
          <button
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 text-xs"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
