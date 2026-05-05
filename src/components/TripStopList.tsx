import { useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TripStop, Cluster, ClusterTimeline, StopTimeline } from '../types/trip';
import { TripStopRow } from './TripStopRow';
import { interClusterWalkMinutes } from '../utils/clustering';

interface TimelineData {
  clusterTimelines: Map<string, ClusterTimeline>;
  stopTimelines: Map<number, StopTimeline>;
}

interface Props {
  clusters: Cluster[];
  closedStops: TripStop[];
  onRemove?: (shopId: number) => void;
  onToggleVisited?: (shopId: number) => void;
  onReorderClusters?: (fromIdx: number, toIdx: number) => void;
  onReorderShopInCluster?: (clusterIdx: number, fromIdx: number, toIdx: number) => void;
  onDurationChange?: (shopId: number, duration: number) => void;
  onSelectShop?: (shopId: number) => void;
  aiNotes?: Map<number, string>;
  shopDurations?: Map<number, number>;
  timeline?: TimelineData | null;
  stopDistances?: Map<number, number>;
  totalStops: number;
  hasTimeWindow: boolean;
  feasibility?: { needed: number; available: number; ratio: number };
  /** Use move buttons instead of drag-and-drop (better for mobile drawers) */
  useMoveButtons?: boolean;
}

// Sortable wrapper for a cluster
function SortableCluster({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        {children}
      </div>
    </div>
  );
}

// Sortable wrapper for a shop row
function SortableShopRow({ stop, onRemove, onToggleVisited, onDurationChange, onSelect, aiNote, duration, stopTimeline, distance, draggable }: {
  stop: TripStop;
  onRemove?: () => void;
  onToggleVisited?: () => void;
  onDurationChange?: (duration: number) => void;
  onSelect?: () => void;
  aiNote?: string;
  duration?: number;
  stopTimeline?: StopTimeline;
  distance?: number;
  draggable?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `shop-${stop.shop.id}`,
    disabled: !draggable,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-center">
        {/* Drag handle — only in edit mode */}
        {draggable && (
          <div {...attributes} {...listeners} className="shrink-0 px-1 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 select-none">
            ⠿
          </div>
        )}
        <div className="flex-1 min-w-0">
          <TripStopRow
            stop={stop}
            onRemove={onRemove}
            onToggleVisited={onToggleVisited}
            onDurationChange={onDurationChange}
            onSelect={onSelect}
            aiNote={aiNote}
            duration={duration}
            stopTimeline={stopTimeline}
            distance={distance}
          />
        </div>
      </div>
    </div>
  );
}

export function TripStopList({ clusters, closedStops, onRemove, onToggleVisited, onReorderClusters, onReorderShopInCluster, onDurationChange, onSelectShop, aiNotes, shopDurations, timeline, stopDistances, totalStops, hasTimeWindow, feasibility, useMoveButtons }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  // Handle cluster reorder
  const handleClusterDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorderClusters) return;
    const fromIdx = clusters.findIndex(c => c.id === active.id);
    const toIdx = clusters.findIndex(c => c.id === over.id);
    if (fromIdx >= 0 && toIdx >= 0) onReorderClusters(fromIdx, toIdx);
  }, [clusters, onReorderClusters]);

  // Handle shop reorder within a cluster
  const makeShopDragHandler = useCallback((clusterIdx: number) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorderShopInCluster) return;
    const cluster = clusters[clusterIdx];
    const fromIdx = cluster.stops.findIndex(s => `shop-${s.shop.id}` === active.id);
    const toIdx = cluster.stops.findIndex(s => `shop-${s.shop.id}` === over.id);
    if (fromIdx >= 0 && toIdx >= 0) onReorderShopInCluster(clusterIdx, fromIdx, toIdx);
  }, [clusters, onReorderShopInCluster]);

  if (totalStops === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-gray-400 text-sm text-center">
        在地圖上點選商店<br />加入你的行程
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Feasibility bar */}
      {hasTimeWindow && feasibility && (
        <div className="px-3 py-2 border-b border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>{totalStops - closedStops.length} 間 · 約需 {(feasibility.needed / 60).toFixed(1)}h</span>
            <span>可用 {(feasibility.available / 60).toFixed(1)}h</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                feasibility.ratio <= 0.7 ? 'bg-green-400' :
                feasibility.ratio <= 1.0 ? 'bg-amber-400' :
                'bg-red-400'
              }`}
              style={{ width: `${Math.min(100, feasibility.ratio * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Clusters */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleClusterDragEnd}>
        <SortableContext items={clusters.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {clusters.map((cluster, i) => (
            <div key={cluster.id}>
              {useMoveButtons ? (
                // Move-button mode for cluster header
                <div className="px-3 py-1.5 bg-gray-50 text-xs font-medium text-gray-500 flex items-center gap-1">
                  <div className="shrink-0 flex gap-1 mr-1">
                    <button
                      onClick={() => { if (i > 0 && onReorderClusters) onReorderClusters(i, i - 1); }}
                      disabled={i === 0}
                      className="w-7 h-7 flex items-center justify-center rounded text-gray-400 disabled:opacity-20 active:bg-blue-50 active:text-blue-600 text-sm"
                    >▲</button>
                    <button
                      onClick={() => { if (i < clusters.length - 1 && onReorderClusters) onReorderClusters(i, i + 1); }}
                      disabled={i === clusters.length - 1}
                      className="w-7 h-7 flex items-center justify-center rounded text-gray-400 disabled:opacity-20 active:bg-blue-50 active:text-blue-600 text-sm"
                    >▼</button>
                  </div>
                  <span>📍</span>
                  <span>{cluster.name}</span>
                  <span className="text-gray-300">({cluster.stops.length} 間)</span>
                </div>
              ) : (
                <SortableCluster id={cluster.id}>
                  {/* Cluster header — drag handle */}
                  <div className="px-3 py-1.5 bg-gray-50 text-xs font-medium text-gray-500 flex items-center gap-1">
                    <span className="text-gray-300 mr-1">⠿</span>
                    <span>📍</span>
                    <span>{cluster.name}</span>
                    <span className="text-gray-300">({cluster.stops.length} 間)</span>
                    {timeline?.clusterTimelines.get(cluster.id) && (
                      <span className="ml-auto text-gray-400">
                        {timeline.clusterTimelines.get(cluster.id)!.arrivalStr}-{timeline.clusterTimelines.get(cluster.id)!.departureStr}
                      </span>
                    )}
                  </div>
                </SortableCluster>
              )}

              {/* Shops within cluster */}
              {useMoveButtons ? (
                // Move-button mode (mobile reorder)
                cluster.stops.map((stop, j) => (
                  <div key={stop.shop.id} className="flex items-center border-b border-gray-50">
                    <div className="shrink-0 flex flex-col">
                      <button
                        onClick={() => {
                          if (j > 0 && onReorderShopInCluster) onReorderShopInCluster(i, j, j - 1);
                        }}
                        disabled={j === 0}
                        className="w-10 h-8 flex items-center justify-center text-gray-400 disabled:opacity-20 active:bg-blue-50 active:text-blue-600 text-base"
                      >▲</button>
                      <button
                        onClick={() => {
                          if (j < cluster.stops.length - 1 && onReorderShopInCluster) onReorderShopInCluster(i, j, j + 1);
                        }}
                        disabled={j === cluster.stops.length - 1}
                        className="w-10 h-8 flex items-center justify-center text-gray-400 disabled:opacity-20 active:bg-blue-50 active:text-blue-600 text-base"
                      >▼</button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <TripStopRow
                        stop={stop}
                        duration={shopDurations?.get(stop.shop.id)}
                      />
                    </div>
                  </div>
                ))
              ) : (
                // Drag mode (desktop)
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={makeShopDragHandler(i)}>
                  <SortableContext items={cluster.stops.map(s => `shop-${s.shop.id}`)} strategy={verticalListSortingStrategy}>
                    {cluster.stops.map(stop => (
                      <SortableShopRow
                        key={stop.shop.id}
                        stop={stop}
                        onRemove={onRemove ? () => onRemove(stop.shop.id) : undefined}
                        onToggleVisited={onToggleVisited ? () => onToggleVisited(stop.shop.id) : undefined}
                        onDurationChange={onDurationChange ? (d: number) => onDurationChange(stop.shop.id, d) : undefined}
                        onSelect={onSelectShop ? () => onSelectShop(stop.shop.id) : undefined}
                        aiNote={aiNotes?.get(stop.shop.id)}
                        duration={shopDurations?.get(stop.shop.id)}
                        stopTimeline={timeline?.stopTimelines.get(stop.shop.id)}
                        distance={stopDistances?.get(stop.shop.id)}
                        draggable={!!onReorderShopInCluster}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}

              {/* Inter-cluster walk time */}
              {i < clusters.length - 1 && (
                <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-gray-400">
                  <div className="flex-1 border-t border-dashed border-gray-200" />
                  <span>🚶 步行 {interClusterWalkMinutes(cluster, clusters[i + 1])} 分</span>
                  <div className="flex-1 border-t border-dashed border-gray-200" />
                </div>
              )}
            </div>
          ))}
        </SortableContext>
      </DndContext>

      {/* Closed stops section */}
      {closedStops.length > 0 && (
        <div>
          <div className="px-3 py-1.5 bg-red-50/50 text-xs font-medium text-red-400 flex items-center gap-1">
            <span>❌</span>
            <span>當天公休 ({closedStops.length} 間)</span>
          </div>
          {closedStops.map(stop => (
            <div key={stop.shop.id} className="pl-5">
              <TripStopRow
                stop={stop}
                onRemove={onRemove ? () => onRemove(stop.shop.id) : undefined}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
