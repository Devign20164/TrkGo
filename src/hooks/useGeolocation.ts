import { useState, useCallback } from 'react';
import { getCurrentPosition, isPointInPolygon, type Coordinates, type GeofencePolygon } from '@/lib/geolocation';

interface UseGeolocationResult {
  coordinates: Coordinates | null;
  isLoading: boolean;
  error: string | null;
  isInsideGeofence: boolean | null;
  checkLocation: (geofence: GeofencePolygon[]) => Promise<boolean>;
  resetLocation: () => void;
}

export function useGeolocation(): UseGeolocationResult {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInsideGeofence, setIsInsideGeofence] = useState<boolean | null>(null);

  const checkLocation = useCallback(async (geofence: GeofencePolygon[]): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const position = await getCurrentPosition();
      const coords: Coordinates = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      
      setCoordinates(coords);
      const inside = isPointInPolygon(coords, geofence);
      setIsInsideGeofence(inside);
      setIsLoading(false);
      
      return inside;
    } catch (err) {
      const errorMessage = err instanceof GeolocationPositionError
        ? getGeolocationErrorMessage(err)
        : 'Failed to get your location';
      
      setError(errorMessage);
      setIsLoading(false);
      return false;
    }
  }, []);

  const resetLocation = useCallback(() => {
    setCoordinates(null);
    setIsInsideGeofence(null);
    setError(null);
  }, []);

  return {
    coordinates,
    isLoading,
    error,
    isInsideGeofence,
    checkLocation,
    resetLocation
  };
}

function getGeolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location permission denied. Please enable location access in your browser settings.';
    case error.POSITION_UNAVAILABLE:
      return 'Location information is unavailable. Please try again.';
    case error.TIMEOUT:
      return 'Location request timed out. Please try again.';
    default:
      return 'An unknown error occurred while getting your location.';
  }
}
