import { useCallback, useEffect, useState } from 'react';
import { fetchTripInvite, joinTripViaInvite, fetchTripById } from '../lib/tripCollabApi';

interface Props {
  inviteId: string;
  isLoggedIn: boolean;
  onLogin: () => void;
  onJoined: (tripId: string) => void;
  onCancel: () => void;
}

export function TripInviteJoin({ inviteId, isLoggedIn, onLogin, onJoined, onCancel }: Props) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'joining' | 'done' | 'error'>('loading');
  const [tripName, setTripName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const invite = await fetchTripInvite(inviteId);
      if (cancelled) return;
      if (!invite) {
        setStatus('error');
        setError('邀請連結無效或已過期');
        return;
      }
      try {
        const trip = await fetchTripById(invite.tripId);
        if (!cancelled) setTripName(trip.name || '未命名行程');
      } catch {
        if (!cancelled) setTripName('行程');
      }
      if (!cancelled) setStatus('ready');
    })();
    return () => { cancelled = true; };
  }, [inviteId]);

  const handleJoin = useCallback(async () => {
    setStatus('joining');
    try {
      const result = await joinTripViaInvite(inviteId);
      if ('error' in result) {
        setError(result.error === 'INVITE_EXPIRED' ? '邀請已過期' : '加入失敗');
        setStatus('error');
        return;
      }
      setStatus('done');
      // Clear the hash
      window.location.hash = '';
      onJoined(result.tripId);
    } catch {
      setError('加入失敗');
      setStatus('error');
    }
  }, [inviteId, onJoined]);

  // Auto-join if logged in
  useEffect(() => {
    if (status === 'ready' && isLoggedIn) {
      handleJoin();
    }
  }, [status, isLoggedIn, handleJoin]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
        {status === 'loading' && (
          <>
            <div className="text-gray-400 text-sm mb-2">載入中...</div>
          </>
        )}

        {status === 'ready' && !isLoggedIn && (
          <>
            <div className="text-2xl mb-3">🗾</div>
            <div className="text-lg font-semibold text-gray-800 mb-1">加入行程</div>
            <div className="text-sm text-gray-500 mb-4">
              有人邀請你加入「{tripName}」
            </div>
            <button
              onClick={onLogin}
              className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors mb-2"
            >
              使用 Google 登入以加入
            </button>
            <button
              onClick={onCancel}
              className="w-full py-2 rounded-lg text-gray-500 text-sm hover:bg-gray-100 transition-colors"
            >
              取消
            </button>
          </>
        )}

        {(status === 'ready' || status === 'joining') && isLoggedIn && (
          <>
            <div className="text-gray-400 text-sm">正在加入「{tripName}」...</div>
          </>
        )}

        {status === 'done' && (
          <>
            <div className="text-2xl mb-3">✓</div>
            <div className="text-lg font-semibold text-green-700">已加入行程</div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-2xl mb-3">✕</div>
            <div className="text-lg font-semibold text-red-600 mb-1">無法加入</div>
            <div className="text-sm text-gray-500 mb-4">{error}</div>
            <button
              onClick={onCancel}
              className="w-full py-2 rounded-lg bg-gray-100 text-gray-600 text-sm hover:bg-gray-200 transition-colors"
            >
              關閉
            </button>
          </>
        )}
      </div>
    </div>
  );
}
