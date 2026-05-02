import { useState } from 'react';
import type { List } from '../types/list';

interface Props {
  lists: List[];
  activeListId: string | null;
  onSelectList: (listId: string) => void;
  onCreate: (name: string) => void;
  onDelete: (listId: string) => void;
  onClose: () => void;
  loggedIn: boolean;
  onSignIn: () => void;
}

export function ListDrawer({ lists, activeListId, onSelectList, onCreate, onDelete, onClose, loggedIn, onSignIn }: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    onCreate(name);
    setNewName('');
    setCreating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white w-full sm:max-w-md rounded-t-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">我的清單</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {!loggedIn ? (
          <div className="px-4 py-8 text-center">
            <p className="text-gray-400 text-sm mb-3">登入後即可建立清單</p>
            <button
              onClick={onSignIn}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium"
            >
              登入
            </button>
          </div>
        ) : (
          <>
            <div className="max-h-[50vh] overflow-y-auto">
              {lists.length === 0 && !creating && (
                <p className="px-4 py-6 text-center text-gray-400 text-sm">還沒有清單</p>
              )}

              {lists.map((list) => (
                <div key={list.id} className="flex items-center group">
                  <button
                    onClick={() => { onSelectList(list.id); onClose(); }}
                    className={`flex-1 flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                      activeListId === list.id ? 'bg-rose-50' : ''
                    }`}
                  >
                    <span className="text-sm font-medium text-gray-700">{list.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">{list.itemCount || 0} 間</span>
                  </button>
                  <button
                    onClick={() => { if (confirm(`刪除「${list.name}」？`)) onDelete(list.id); }}
                    className="px-3 py-3 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 p-3">
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
      </div>
    </div>
  );
}
