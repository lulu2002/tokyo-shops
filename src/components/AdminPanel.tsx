import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface AdminUser {
  user_id: string;
  email: string;
  display_name: string;
  avatar_url: string;
  created_at: string;
}

interface SearchResult {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string;
}

interface Props {
  currentUserId: string;
  onClose: () => void;
}

export function AdminPanel({ currentUserId, onClose }: Props) {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  // Load current admins
  const loadAdmins = useCallback(async () => {
    const { data, error } = await supabase.rpc('list_admins');
    if (error) {
      console.error('Failed to load admins:', error);
      return;
    }
    setAdmins(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadAdmins(); }, [loadAdmins]);

  // Search users by email
  const handleSearch = useCallback(async () => {
    if (!searchEmail.trim()) return;
    setSearching(true);
    try {
      const { data, error } = await supabase.rpc('search_users_by_email', {
        search_email: searchEmail.trim(),
      });
      if (error) throw error;
      setSearchResults(data || []);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  }, [searchEmail]);

  // Add admin
  const handleAdd = useCallback(async (userId: string) => {
    setAdding(userId);
    try {
      const { error } = await supabase
        .from('admin_users')
        .insert({ user_id: userId });
      if (error) throw error;
      await loadAdmins();
      setSearchResults([]);
      setSearchEmail('');
    } catch (err) {
      console.error('Add admin failed:', err);
      alert('新增失敗: ' + (err instanceof Error ? err.message : '未知錯誤'));
    } finally {
      setAdding(null);
    }
  }, [loadAdmins]);

  // Remove admin
  const handleRemove = useCallback(async (userId: string) => {
    if (userId === currentUserId) {
      alert('不能移除自己的管理員權限');
      return;
    }
    if (!confirm('確定要移除此管理員？')) return;
    try {
      const { error } = await supabase
        .from('admin_users')
        .delete()
        .eq('user_id', userId);
      if (error) throw error;
      await loadAdmins();
    } catch (err) {
      console.error('Remove admin failed:', err);
    }
  }, [currentUserId, loadAdmins]);

  const adminIds = new Set(admins.map(a => a.user_id));

  return (
    <div className="fixed inset-0 z-50 bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1"
          >
            <span>←</span> 返回
          </button>
          <h1 className="text-lg font-bold text-gray-900">管理員設定</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Search section */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">新增管理員</h2>
          <div className="flex gap-2">
            <input
              type="email"
              value={searchEmail}
              onChange={e => setSearchEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="輸入 email 搜尋使用者..."
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <button
              onClick={handleSearch}
              disabled={searching || !searchEmail.trim()}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {searching ? '搜尋中...' : '搜尋'}
            </button>
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="mt-3 space-y-2">
              {searchResults.map(user => {
                const isAlreadyAdmin = adminIds.has(user.id);
                return (
                  <div key={user.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-white text-sm font-bold">
                        {(user.display_name || user.email)[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{user.display_name || '(未命名)'}</div>
                      <div className="text-xs text-gray-500 truncate">{user.email}</div>
                    </div>
                    {isAlreadyAdmin ? (
                      <span className="text-xs text-gray-400 px-3 py-1.5">已是管理員</span>
                    ) : (
                      <button
                        onClick={() => handleAdd(user.id)}
                        disabled={adding === user.id}
                        className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 disabled:opacity-50 transition-colors"
                      >
                        {adding === user.id ? '新增中...' : '+ 新增'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {searchResults.length === 0 && searchEmail && !searching && (
            <div className="mt-3 text-sm text-gray-400 text-center py-2">
              找不到符合的使用者（使用者需先登入過才能搜尋到）
            </div>
          )}
        </div>

        {/* Current admins */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">
            目前管理員 ({admins.length})
          </h2>

          {loading ? (
            <div className="text-sm text-gray-400 text-center py-4">載入中...</div>
          ) : admins.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-4">尚無管理員</div>
          ) : (
            <div className="space-y-1">
              {admins.map(admin => {
                const isMe = admin.user_id === currentUserId;
                return (
                  <div key={admin.user_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                    {admin.avatar_url ? (
                      <img src={admin.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-white text-sm font-bold">
                        {(admin.display_name || admin.email)[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">
                        {admin.display_name || '(未命名)'}
                        {isMe && <span className="text-gray-400 ml-1">(你)</span>}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{admin.email}</div>
                    </div>
                    {!isMe && (
                      <button
                        onClick={() => handleRemove(admin.user_id)}
                        className="text-xs text-red-400 hover:text-red-600 px-2 py-1 transition-colors"
                      >
                        移除
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
