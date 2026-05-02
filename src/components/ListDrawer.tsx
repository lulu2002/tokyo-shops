import { useState } from 'react';
import type { List } from '../types/list';

interface Props {
  lists: List[];
  publicLists: List[];
  activeListIds: string[];
  onToggleList: (listId: string) => void;
  onCreate: (name: string) => void;
  onDelete: (listId: string) => void;
  onTogglePublic: (listId: string, isPublic: boolean) => void;
  onClose: () => void;
  loggedIn: boolean;
  onSignIn: () => void;
}

export function ListDrawer({ lists, publicLists, activeListIds, onToggleList, onCreate, onDelete, onTogglePublic, onClose, loggedIn, onSignIn }: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    onCreate(name);
    setNewName('');
    setCreating(false);
  };

  const handleShare = (list: List) => {
    const url = `${window.location.origin}${window.location.pathname}#list:${list.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(list.id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const ListRow = ({ list, isOwner }: { list: List; isOwner: boolean }) => {
    const isActive = activeListIds.includes(list.id);
    return (
      <div className="border-b border-gray-50">
        <button
          onClick={() => onToggleList(list.id)}
          className={`flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
            isActive ? 'bg-rose-50' : ''
          }`}
        >
          <span className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs shrink-0 ${
            isActive ? 'bg-rose-500 border-rose-500 text-white' : 'border-gray-300'
          }`}>
            {isActive ? '✓' : ''}
          </span>
          <span className="text-sm font-medium text-gray-700">{list.name}</span>
          {list.isPublic && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-700">公開</span>
          )}
          <span className="text-xs text-gray-400 ml-auto">{list.itemCount || 0} 間</span>
        </button>
        {isOwner && (
          <div className="flex items-center gap-1 px-4 pb-2">
            <button
              onClick={() => onTogglePublic(list.id, !list.isPublic)}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                list.isPublic ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {list.isPublic ? '🌐 公開' : '🔒 私人'}
            </button>
            {list.isPublic && (
              <button
                onClick={() => handleShare(list)}
                className="px-2 py-1 rounded text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
              >
                {copied === list.id ? '✓ 已複製' : '🔗 分享'}
              </button>
            )}
            <button
              onClick={() => { if (confirm(`刪除「${list.name}」？`)) onDelete(list.id); }}
              className="px-2 py-1 rounded text-xs text-gray-400 hover:text-red-500 transition-colors ml-auto"
            >
              刪除
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white w-full sm:max-w-md rounded-t-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">清單</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {loggedIn && (
            <>
              <div className="px-4 pt-3 pb-1">
                <p className="text-xs font-medium text-gray-400 uppercase">我的清單</p>
              </div>
              {lists.length === 0 && !creating && (
                <p className="px-4 py-4 text-center text-gray-400 text-sm">還沒有清單</p>
              )}
              {lists.map((list) => (
                <ListRow key={list.id} list={list} isOwner />
              ))}
              <div className="p-3 border-b border-gray-100">
                {creating ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                      placeholder="清單名稱"
                      autoFocus
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-rose-400"
                    />
                    <button
                      onClick={handleCreate}
                      disabled={!newName.trim()}
                      className="px-4 py-2 rounded-lg bg-rose-500 text-white text-sm font-medium disabled:opacity-40"
                    >
                      建立
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setCreating(true)}
                    className="w-full py-2 text-sm text-rose-500 font-medium hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    + 建立新清單
                  </button>
                )}
              </div>
            </>
          )}

          {publicLists.length > 0 && (
            <>
              <div className="px-4 pt-3 pb-1">
                <p className="text-xs font-medium text-gray-400 uppercase">其他人的清單</p>
              </div>
              {publicLists.map((list) => (
                <ListRow key={list.id} list={list} isOwner={false} />
              ))}
            </>
          )}

          {!loggedIn && publicLists.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-gray-400 text-sm mb-3">登入後即可建立清單</p>
              <button onClick={onSignIn} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium">登入</button>
            </div>
          )}
          {!loggedIn && publicLists.length > 0 && (
            <div className="p-3 border-t border-gray-100 text-center">
              <button onClick={onSignIn} className="text-sm text-gray-500 hover:text-gray-700">登入以建立自己的清單</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
