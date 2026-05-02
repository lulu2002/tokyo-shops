import { CATEGORIES } from '../constants/categories';

interface Props {
  activeCategory: string | null;
  onSelect: (key: string | null) => void;
  counts: Record<string, number>;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
}

export function CategoryTabs({ activeCategory, onSelect, counts, viewMode, onViewModeChange }: Props) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="border-b border-gray-200">
      <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto no-scrollbar">
        {/* View toggle */}
        <div className="shrink-0 flex rounded-lg border border-gray-200 overflow-hidden mr-1">
          <button
            onClick={() => onViewModeChange('grid')}
            className={`px-2 py-1.5 text-sm transition-colors ${
              viewMode === 'grid' ? 'bg-gray-900 text-white' : 'bg-white text-gray-400 hover:text-gray-600'
            }`}
            title="卡片模式"
          >
            ▦
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`px-2 py-1.5 text-sm transition-colors ${
              viewMode === 'list' ? 'bg-gray-900 text-white' : 'bg-white text-gray-400 hover:text-gray-600'
            }`}
            title="清單模式"
          >
            ☰
          </button>
        </div>

        <button
          onClick={() => onSelect(null)}
          className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeCategory === null
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          全部 ({total})
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => onSelect(cat.key)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeCategory === cat.key
                ? `${cat.color} text-white`
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat.label} ({counts[cat.key] || 0})
          </button>
        ))}
      </div>
    </div>
  );
}
