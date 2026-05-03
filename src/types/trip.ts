import type { Shop } from './shop';

export interface OpenWindow {
  open: number;  // minutes from midnight
  close: number; // minutes from midnight
  openStr: string;  // "10:00"
  closeStr: string; // "19:00"
}

export interface TripStop {
  shop: Shop;
  openWindow: OpenWindow | null; // null = unknown hours
  closed: boolean;               // true = closed that day
  visited: boolean;
}

export interface Cluster {
  id: string;
  name: string;
  stops: TripStop[];
  centroid: { lat: number; lng: number };
}

export interface TripState {
  tripDate: Date;
  startTime: string | null;
  endTime: string | null;
  stops: TripStop[];
}

export interface ClusterTimeline {
  clusterId: string;
  estimatedArrival: number;
  estimatedDeparture: number;
  arrivalStr: string;
  departureStr: string;
}

export interface StopTimeline {
  shopId: number;
  estimatedArrival: number;
  arrivalStr: string;
  willBeClosed: boolean;
  minutesUntilClose: number;
}
