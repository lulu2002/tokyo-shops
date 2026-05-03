import { useCallback, useState } from 'react';
import { createTripInvite, migrateTrioToCollaborative } from '../lib/tripCollabApi';

interface Props {
  tripId: string;
  isCollaborative: boolean;
  onBecameCollaborative?: () => void;
}

export function TripShareButton({ tripId, isCollaborative, onBecameCollaborative }: Props) {
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [showMenu, setShowMenu] = useState(false);

  const handleShare = useCallback(async () => {
    setSharing(true);
    try {
      // Migrate to collaborative if needed
      if (!isCollaborative) {
        await migrateTrioToCollaborative(tripId);
        onBecameCollaborative?.();
      }

      const invite = await createTripInvite(tripId, role);
      const url = `${window.location.origin}${window.location.pathname}#trip-invite:${invite.id}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setShowMenu(false);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Share failed:', err);
      alert('分享失敗: ' + (err instanceof Error ? err.message : '未知錯誤'));
    } finally {
      setSharing(false);
    }
  }, [tripId, isCollaborative, role, onBecameCollaborative]);

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(v => !v)}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          copied
            ? 'bg-green-100 text-green-700'
            : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
        }`}
      >
        {copied ? '已複製連結' : '分享'}
      </button>

      {showMenu && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-3 w-56">
            <div className="text-sm font-medium text-gray-800 mb-2">分享行程</div>
            <div className="text-xs text-gray-500 mb-3">產生邀請連結，讓朋友加入你的行程</div>

            {/* Role selector */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setRole('editor')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  role === 'editor' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                可編輯
              </button>
              <button
                onClick={() => setRole('viewer')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  role === 'viewer' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                僅檢視
              </button>
            </div>

            <button
              onClick={handleShare}
              disabled={sharing}
              className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {sharing ? '產生中...' : '複製邀請連結'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
