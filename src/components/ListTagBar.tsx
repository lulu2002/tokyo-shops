import type { List } from '../types/list';

interface Props {
  activeListIds: string[];
  allLists: List[];
  onToggleList: (listId: string) => void;
  onOpenDrawer: () => void;
}

export function ListTagBar({ activeListIds, allLists, onToggleList, onOpenDrawer }: Props) {
  const activeLists = activeListIds
    .map((id) => allLists.find((l) => l.id === id))
    .filter(Boolean) as List[];

  return (
    <div className="bg-white border-b border-gray-100 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar">
        {activeLists.map((list) => (
          <button
            key={list.id}
            onClick={() => onToggleList(list.id)}
            className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full bg-rose-100 text-rose-700 text-sm font-medium hover:bg-rose-200 transition-colors"
          >
            {list.name}
            <span className="text-rose-400">✕</span>
          </button>
        ))}
        <button
          onClick={onOpenDrawer}
          className="shrink-0 px-3 py-1.5 rounded-full bg-gray-100 text-gray-500 text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          + 清單
        </button>
        {activeLists.length > 0 && (
          <span className="text-xs text-gray-400 shrink-0 ml-auto">
            {activeLists.length > 1 ? '重疊優先' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
