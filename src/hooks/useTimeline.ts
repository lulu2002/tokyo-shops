import { useMemo } from 'react';
import type { Cluster, ClusterTimeline, StopTimeline } from '../types/trip';
import { interClusterWalkMinutes } from '../utils/clustering';

// Default duration is now per-shop from shop.visitDuration, falling back to 20

function minutesToStr(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${h}:${min.toString().padStart(2, '0')}`;
}

interface TimelineResult {
  clusterTimelines: Map<string, ClusterTimeline>;
  stopTimelines: Map<number, StopTimeline>;
}

export function useTimeline(
  clusters: Cluster[],
  startTimeStr: string,
  shopDurations: Map<number, number>,
): TimelineResult | null {
  return useMemo(() => {
    if (!startTimeStr) return null;

    const parts = startTimeStr.split(':');
    const startMin = parseInt(parts[0]) * 60 + parseInt(parts[1] || '0');
    if (isNaN(startMin)) return null;

    const clusterTimelines = new Map<string, ClusterTimeline>();
    const stopTimelines = new Map<number, StopTimeline>();

    let currentTime = startMin;

    for (let ci = 0; ci < clusters.length; ci++) {
      const cluster = clusters[ci];
      const clusterArrival = currentTime;

      for (const stop of cluster.stops) {
        const arrival = currentTime;
        const closeTime = stop.openWindow?.close ?? Infinity;
        const willBeClosed = closeTime !== Infinity && arrival >= closeTime;
        const minutesUntilClose = closeTime !== Infinity ? closeTime - arrival : Infinity;

        stopTimelines.set(stop.shop.id, {
          shopId: stop.shop.id,
          estimatedArrival: arrival,
          arrivalStr: minutesToStr(arrival),
          willBeClosed,
          minutesUntilClose,
        });

        const duration = shopDurations.get(stop.shop.id) ?? stop.shop.visitDuration ?? 20;
        currentTime += duration;
      }

      clusterTimelines.set(cluster.id, {
        clusterId: cluster.id,
        estimatedArrival: clusterArrival,
        estimatedDeparture: currentTime,
        arrivalStr: minutesToStr(clusterArrival),
        departureStr: minutesToStr(currentTime),
      });

      // Add walk time to next cluster
      if (ci < clusters.length - 1) {
        currentTime += interClusterWalkMinutes(cluster, clusters[ci + 1]);
      }
    }

    return { clusterTimelines, stopTimelines };
  }, [clusters, startTimeStr, shopDurations]);
}
