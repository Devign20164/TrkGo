// Geolocation utilities for TrikGo

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GeofencePolygon {
  lat: number;
  lng: number;
}

// Check if a point is inside a polygon using ray casting algorithm
export function isPointInPolygon(point: Coordinates, polygon: GeofencePolygon[]): boolean {
  if (polygon.length < 3) return false;
  
  let inside = false;
  const { lat, lng } = point;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;
    
    const intersect = ((yi > lng) !== (yj > lng)) &&
      (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }
  
  return inside;
}

// Get current position as a promise
export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
  });
}

// Calculate distance between two points in kilometers (Haversine formula)
export function calculateDistance(point1: Coordinates, point2: Coordinates): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(point2.lat - point1.lat);
  const dLon = toRad(point2.lng - point1.lng);
  const lat1 = toRad(point1.lat);
  const lat2 = toRad(point2.lat);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Calculate fare based on trip type and distance
export function calculateFare(tripType: 'village' | 'outbound', distanceKm: number): number {
  // Base fares (in PHP)
  const VILLAGE_BASE_FARE = 20;
  const OUTBOUND_BASE_FARE = 40;
  const RATE_PER_KM = 10;
  
  const baseFare = tripType === 'village' ? VILLAGE_BASE_FARE : OUTBOUND_BASE_FARE;
  const distanceFare = Math.ceil(distanceKm) * RATE_PER_KM;
  
  return Math.max(baseFare, baseFare + distanceFare);
}

// Format coordinates for display
export function formatCoordinates(coords: Coordinates): string {
  return `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
}
