interface Props {
  listName: string;
  count: number;
  onClear: () => void;
}

export function ListFilterBar({ listName, count, onClear }: Props) {
  return (
    <div className="bg-rose-50 border-b border-rose-100 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between text-sm">
        <span className="text-rose-700">
          📋 正在查看：<span className="font-medium">{listName}</span>
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
