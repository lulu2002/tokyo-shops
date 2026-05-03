import { useState } from 'react';
import type { User } from '@supabase/supabase-js';

interface Props {
  user: User | null;
  isAdmin?: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onOpenLists: () => void;
  onOpenAdminPanel?: () => void;
  hasPublicLists: boolean;
}

export function UserMenu({ user, isAdmin, onSignIn, onSignOut, onOpenLists, onOpenAdminPanel, hasPublicLists }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        {hasPublicLists && (
          <button
            onClick={onOpenLists}
            className="px-2 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors text-lg"
            title="清單"
          >
            📋
          </button>
        )}
        <button
          onClick={onSignIn}
          className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          登入
        </button>
      </div>
    );
  }

  const avatar = user.user_metadata?.avatar_url;
  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || '';

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onOpenLists}
        className="px-2 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors text-lg"
        title="清單"
      >
        📋
      </button>
      <span className="text-sm text-gray-600 hidden sm:inline">{name}</span>

      {/* Avatar with dropdown */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="focus:outline-none focus:ring-2 focus:ring-blue-300 rounded-full"
        >
          {avatar ? (
            <img src={avatar} alt="" className="w-8 h-8 rounded-full cursor-pointer hover:ring-2 hover:ring-gray-300 transition-shadow" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm text-white font-medium cursor-pointer hover:ring-2 hover:ring-gray-300 transition-shadow">
              {name[0]?.toUpperCase()}
            </div>
          )}
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-gray-200 py-1 w-44 overflow-hidden">
              {/* User info */}
              <div className="px-3 py-2 border-b border-gray-100">
                <div className="text-sm font-medium text-gray-800 truncate">{name}</div>
                <div className="text-xs text-gray-400 truncate">{user.email}</div>
              </div>

              {/* Admin panel */}
              {isAdmin && onOpenAdminPanel && (
                <button
                  onClick={() => { setMenuOpen(false); onOpenAdminPanel(); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                  </svg>
                  管理員設定
                </button>
              )}

              {/* Sign out */}
              <button
                onClick={() => { setMenuOpen(false); onSignOut(); }}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
                登出
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
