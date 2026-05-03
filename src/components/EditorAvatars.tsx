import { useState } from 'react';
import type { PresenceUser } from '../types/trip';

interface Props {
  editors: PresenceUser[];
  maxVisible?: number;
  onExpand?: () => void;
  compact?: boolean;
}

function userColor(userId: string): string {
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

export function EditorAvatars({ editors, maxVisible = 3, onExpand, compact }: Props) {
  const [showTooltip, setShowTooltip] = useState<string | null>(null);

  if (editors.length === 0) return null;

  // Compact mode: just show count badge (for mobile)
  if (compact) {
    return (
      <button
        onClick={onExpand}
        className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
        {editors.length}
      </button>
    );
  }

  const visible = editors.slice(0, maxVisible);
  const remaining = editors.length - maxVisible;

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {visible.map(editor => (
          <div
            key={editor.userId}
            className="relative"
            onMouseEnter={() => setShowTooltip(editor.userId)}
            onMouseLeave={() => setShowTooltip(null)}
          >
            {editor.avatarUrl ? (
              <img
                src={editor.avatarUrl}
                alt={editor.displayName}
                className="w-7 h-7 rounded-full object-cover"
                style={{ border: `2px solid ${userColor(editor.userId)}` }}
              />
            ) : (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: userColor(editor.userId), border: '2px solid white' }}
              >
                {(editor.displayName || '?')[0].toUpperCase()}
              </div>
            )}
            {/* Green online dot */}
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-white" />

            {/* Tooltip */}
            {showTooltip === editor.userId && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50">
                {editor.displayName || 'Unknown'}
              </div>
            )}
          </div>
        ))}
        {remaining > 0 && (
          <button
            onClick={onExpand}
            className="w-7 h-7 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center border-2 border-white hover:bg-gray-300 transition-colors"
          >
            +{remaining}
          </button>
        )}
      </div>
    </div>
  );
}
