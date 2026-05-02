import type { List } from '../types/list';

interface Props {
  activeListIds: string[];
  allLists: List[];
  count: number;
  onClear: () => void;
}

export function ListFilterBar({ activeListIds, allLists, count, onClear }: Props) {
  const names = activeListIds
    .map((id) => allLists.find((l) => l.id === id)?.name || '清單')
    .join(' + ');

  return (
    <div className="bg-rose-50 border-b border-rose-100 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between text-sm">
        <span className="text-rose-700">
          📋 <span className="font-medium">{names}</span>
          <span className="text-rose-400 ml-1">({count} 間)</span>
        </span>
        <button
          onClick={onClear}
          className="px-2 py-1 rounded text-rose-500 hover:bg-rose-100 transition-colors"
        >
          ✕ 清除
        </button>
      </div>
    </div>
  );
}
