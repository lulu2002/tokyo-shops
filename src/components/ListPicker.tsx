import { useState } from 'react';
import type { List } from '../types/list';

interface Props {
  lists: List[];
  shopInLists: string[]; // list IDs this shop is in
  onToggle: (listId: string, add: boolean) => void;
  onCreate: (name: string) => void;
  onClose: () => void;
}

export function ListPicker({ lists, shopInLists, onToggle, onCreate, onClose }: Props) {
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
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative bg-white w-full sm:max-w-sm sm:rounded-xl rounded-t-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">加入清單</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {lists.length === 0 && !creating && (
            <p className="px-4 py-6 text-center text-gray-400 text-sm">還沒有清單，建立一個吧</p>
          )}

          {lists.map((list) => {
            const inList = shopInLists.includes(list.id);
            return (
              <button
                key={list.id}
                onClick={() => onToggle(list.id, !inList)}
                className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <span className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs ${
                  inList ? 'bg-rose-500 border-rose-500 text-white' : 'border-gray-300'
                }`}>
                  {inList ? '✓' : ''}
                </span>
                <span className="text-sm text-gray-700">{list.name}</span>
                {list.itemCount !== undefined && (
                  <span className="text-xs text-gray-400 ml-auto">{list.itemCount}</span>
                )}
              </button>
            );
          })}
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
      </div>
    </div>
  );
}
