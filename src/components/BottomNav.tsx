interface Props {
  active: 'explore' | 'map' | 'trip' | 'lists';
  onChange: (tab: 'explore' | 'map' | 'trip' | 'lists') => void;
  tripCount?: number;
  listCount?: number;
}

const tabs = [
  { id: 'explore' as const, label: '探索', icon: '◉' },
  { id: 'map' as const, label: '地圖', icon: '⌖' },
  { id: 'trip' as const, label: '行程', icon: '▤' },
  { id: 'lists' as const, label: '清單', icon: '♡' },
];

export function BottomNav({ active, onChange, tripCount, listCount }: Props) {
  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-bottom">
      <div className="flex">
        {tabs.map(tab => {
          const isActive = active === tab.id;
          const badge = tab.id === 'trip' ? tripCount : tab.id === 'lists' ? listCount : undefined;

          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex-1 flex flex-col items-center py-2 pt-2.5 transition-colors ${
                isActive ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              <span className="relative text-lg leading-none">
                {tab.icon}
                {badge !== undefined && badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </span>
              <span className="text-[10px] mt-0.5 font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
