import { useCallback, useEffect, useState, type ReactNode } from 'react';

const SNAP_PEEK = 40;
const SNAP_FULL = 90;

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Whether reorder mode is active */
  reorderMode?: boolean;
  onToggleReorder?: () => void;
}

export function MobileDrawer({ open, onClose, title, children, reorderMode, onToggleReorder }: Props) {
  const [heightPct, setHeightPct] = useState(0);
  const [visible, setVisible] = useState(false);
  const isFull = heightPct >= SNAP_FULL;

  // Animate open/close
  useEffect(() => {
    if (open) {
      setVisible(true);
      setHeightPct(0);
      const timer = setTimeout(() => setHeightPct(SNAP_PEEK), 50);
      return () => clearTimeout(timer);
    } else if (visible) {
      setHeightPct(0);
      const timer = setTimeout(() => setVisible(false), 350);
      return () => clearTimeout(timer);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSize = useCallback(() => {
    setHeightPct(prev => prev >= SNAP_FULL ? SNAP_PEEK : SNAP_FULL);
  }, []);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!visible) return null;

  return (
    <div className="sm:hidden absolute inset-x-0 bottom-0 z-20">
      <div
        className="bg-white rounded-t-2xl shadow-2xl border-t border-gray-200 flex flex-col transition-[height] duration-300 ease-out"
        style={{ height: heightPct > 0 ? `${heightPct}vh` : '0vh' }}
      >
        {/* Header */}
        <div className="shrink-0 px-3 py-2.5 flex items-center gap-2 border-b border-gray-100">
          <span className="text-sm font-medium text-gray-700 flex-1 truncate">{title}</span>

          {/* Reorder toggle */}
          {onToggleReorder && (
            <button
              onClick={onToggleReorder}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                reorderMode
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {reorderMode ? '完成' : '排序'}
            </button>
          )}

          {/* Expand / Collapse */}
          <button
            onClick={toggleSize}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 text-xs"
            title={isFull ? '收合' : '展開'}
          >
            {isFull ? '▾' : '▴'}
          </button>

          {/* Close */}
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
