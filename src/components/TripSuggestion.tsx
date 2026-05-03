interface SuggestedShop {
  id: number;
  priority: 'high' | 'normal';
  note: string;
}

interface SuggestedCluster {
  clusterName: string;
  reason: string;
  shops: SuggestedShop[];
}

interface Warning {
  shopId: number;
  type: 'closed' | 'tight';
  message: string;
}

export interface RouteSuggestion {
  suggestedOrder: SuggestedCluster[];
  warnings: Warning[];
  summary: string;
  feasibility: 'comfortable' | 'tight' | 'impossible';
}

interface Props {
  suggestion: RouteSuggestion;
  shopNames: Map<number, string>;
  onDismiss: () => void;
  onApply: () => void;
  applied: boolean;
}

function resolveShopName(id: number | string, shopNames: Map<number, string>): string {
  // Try numeric ID first
  if (typeof id === 'number') {
    return shopNames.get(id) || `#${id}`;
  }
  // If AI returned a string (shop name), try to use it directly
  const numId = Number(id);
  if (!isNaN(numId)) {
    return shopNames.get(numId) || `#${numId}`;
  }
  // AI returned the shop name as the id — just use it
  return String(id);
}

export function TripSuggestion({ suggestion, shopNames, onDismiss, onApply, applied }: Props) {
  const feasColor = suggestion.feasibility === 'comfortable'
    ? 'text-green-600 bg-green-50'
    : suggestion.feasibility === 'tight'
    ? 'text-amber-600 bg-amber-50'
    : 'text-red-600 bg-red-50';

  const feasLabel = suggestion.feasibility === 'comfortable'
    ? '時間充裕'
    : suggestion.feasibility === 'tight'
    ? '時間偏緊'
    : '時間不足';

  return (
    <div className="border-t border-gray-100">
      {/* Header */}
      <div className="px-3 py-2 bg-indigo-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-indigo-700">AI 建議路線</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${feasColor}`}>
            {feasLabel}
          </span>
        </div>
        <button onClick={onDismiss} className="text-xs text-indigo-400 hover:text-indigo-600">
          收起
        </button>
      </div>

      {/* Summary */}
      <div className="px-3 py-2 text-sm text-gray-600 bg-indigo-50/30 border-b border-indigo-100">
        {suggestion.summary}
      </div>

      {/* Suggested order */}
      {suggestion.suggestedOrder.map((cluster, i) => (
        <div key={i}>
          <div className="px-3 py-1.5 bg-gray-50 text-xs font-medium text-gray-500 flex items-center justify-between">
            <span>
              {i + 1}. {cluster.clusterName}
            </span>
          </div>
          {cluster.reason && (
            <div className="px-3 py-1 text-xs text-indigo-500 bg-indigo-50/20">
              {cluster.reason}
            </div>
          )}
          {cluster.shops.map(shop => (
            <div
              key={shop.id}
              className={`flex items-center gap-2 px-3 py-1.5 ${
                shop.priority === 'high' ? 'bg-amber-50/50' : ''
              }`}
            >
              {shop.priority === 'high' && (
                <span className="text-xs">⭐</span>
              )}
              <span className="text-sm text-gray-800">
                {resolveShopName(shop.id, shopNames)}
              </span>
              {shop.note && (
                <span className="text-xs text-amber-600 ml-auto">{shop.note}</span>
              )}
            </div>
          ))}

          {/* Arrow between clusters */}
          {i < suggestion.suggestedOrder.length - 1 && (
            <div className="flex items-center justify-center py-1 text-xs text-gray-300">
              ↓
            </div>
          )}
        </div>
      ))}

      {/* Warnings */}
      {suggestion.warnings.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-100">
          {suggestion.warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-2 text-xs py-0.5">
              <span>{w.type === 'closed' ? '❌' : '⚠️'}</span>
              <span className="text-gray-500">
                {resolveShopName(w.shopId, shopNames)}：{w.message}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Apply button */}
      <div className="p-3 border-t border-gray-100">
        <button
          onClick={onApply}
          disabled={applied}
          className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
            applied
              ? 'bg-green-50 text-green-600 cursor-default'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {applied ? '已套用建議順序' : '套用建議順序'}
        </button>
      </div>
    </div>
  );
}
