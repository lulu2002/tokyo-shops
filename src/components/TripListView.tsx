import { useEffect, useState } from 'react';
import { listTripsAsync, deleteTripAsync, type SavedTrip } from '../lib/tripStorage';

interface Props {
  onSelectTrip: (trip: SavedTrip) => void;
  onNewTrip: () => void;
}

export function TripListView({ onSelectTrip, onNewTrip }: Props) {
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listTripsAsync().then(setTrips).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (trip: SavedTrip) => {
    if (!confirm(`刪除「${trip.name}」？`)) return;
    await deleteTripAsync(trip.id);
    setTrips(prev => prev.filter(t => t.id !== trip.id));
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">我的行程</h2>
        <button
          onClick={onNewTrip}
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          + 新行程
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">載入中...</div>
      ) : trips.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-sm">還沒有行程</p>
          <p className="text-xs mt-1">點右上角建立你的第一個行程</p>
        </div>
      ) : (
        <div className="space-y-2">
          {trips.map(trip => {
            const visitedCount = trip.visitedIds?.length || 0;
            const totalCount = trip.shopIds.length;
            const today = new Date().toISOString().slice(0, 10);
            const isToday = trip.tripDate === today;
            const isPast = trip.tripDate < today;

            return (
              <div
                key={trip.id}
                className={`bg-white rounded-xl border overflow-hidden transition-shadow hover:shadow-md ${
                  isToday ? 'border-emerald-200' : 'border-gray-200'
                }`}
              >
                <button
                  onClick={() => onSelectTrip(trip)}
                  className="w-full px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium text-gray-900">{trip.name}</span>
                    {trip.isCollaborative && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium">共編</span>
                    )}
                    {isToday && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">今天</span>
                    )}
                    {isPast && !isToday && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">已過</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                    <span>{trip.tripDate}</span>
                    {trip.startTime && trip.endTime && (
                      <span>{trip.startTime}～{trip.endTime}</span>
                    )}
                    <span>{totalCount} 間店</span>
                    {visitedCount > 0 && (
                      <span className="text-emerald-600">{visitedCount}/{totalCount} 已逛</span>
                    )}
                  </div>

                  {visitedCount > 0 && (
                    <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded-full"
                        style={{ width: `${(visitedCount / totalCount) * 100}%` }}
                      />
                    </div>
                  )}
                </button>

                <div className="border-t border-gray-100 px-4 py-1.5 flex justify-end">
                  <button
                    onClick={() => handleDelete(trip)}
                    className="text-xs text-gray-300 hover:text-red-400 transition-colors"
                  >
                    刪除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
