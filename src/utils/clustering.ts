import { haversine, estimateWalkMinutes } from './distance';
import type { TripStop, Cluster } from '../types/trip';

const CLUSTER_THRESHOLD_METERS = 400; // ~5 min walk

/**
 * Group trip stops into walking-distance clusters.
 * Uses a simple greedy approach: for each unassigned stop,
 * find or create a cluster where at least one member is within threshold.
 */
export function clusterStops(stops: TripStop[]): Cluster[] {
  const validStops = stops.filter(s => s.shop.lat && s.shop.lng);
  if (validStops.length === 0) return [];

  const assigned = new Set<number>();
  const clusters: Cluster[] = [];

  for (const stop of validStops) {
    if (assigned.has(stop.shop.id)) continue;

    // Try to find an existing cluster this stop fits into
    let foundCluster: Cluster | null = null;
    for (const cluster of clusters) {
      const isNear = cluster.stops.some(cs =>
        haversine(cs.shop.lat, cs.shop.lng, stop.shop.lat, stop.shop.lng) <= CLUSTER_THRESHOLD_METERS
      );
      if (isNear) {
        foundCluster = cluster;
        break;
      }
    }

    if (foundCluster) {
      foundCluster.stops.push(stop);
      assigned.add(stop.shop.id);
    } else {
      // Create new cluster
      const cluster: Cluster = {
        id: `cluster-${clusters.length}`,
        name: stop.shop.location || stop.shop.address?.match(/東京都(.+?[区市町村])/)?.[1] || '未知區域',
        stops: [stop],
        centroid: { lat: stop.shop.lat, lng: stop.shop.lng },
      };
      clusters.push(cluster);
      assigned.add(stop.shop.id);
    }
  }

  // Recalculate centroids
  for (const cluster of clusters) {
    const lats = cluster.stops.map(s => s.shop.lat);
    const lngs = cluster.stops.map(s => s.shop.lng);
    cluster.centroid = {
      lat: lats.reduce((a, b) => a + b, 0) / lats.length,
      lng: lngs.reduce((a, b) => a + b, 0) / lngs.length,
    };

    // Use the most common location name in the cluster
    const locationCounts = new Map<string, number>();
    for (const s of cluster.stops) {
      const loc = s.shop.location || '';
      if (loc) locationCounts.set(loc, (locationCounts.get(loc) || 0) + 1);
    }
    if (locationCounts.size > 0) {
      cluster.name = [...locationCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }
  }

  return clusters;
}

/**
 * Calculate walking time between two cluster centroids.
 */
export function interClusterWalkMinutes(a: Cluster, b: Cluster): number {
  const meters = haversine(a.centroid.lat, a.centroid.lng, b.centroid.lat, b.centroid.lng);
  return estimateWalkMinutes(meters);
}
