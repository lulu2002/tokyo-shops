const R = 6371000; // Earth radius in meters

export function haversine(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

export function estimateWalkMinutes(meters: number): number {
  return Math.round(meters / 80); // ~80m per minute walking
}

export function formatDistanceLabel(meters: number): string {
  const dist = formatDistance(meters);
  const mins = estimateWalkMinutes(meters);
  if (mins <= 30) {
    return `${dist}（步行 ${mins} 分）`;
  }
  return dist;
}
