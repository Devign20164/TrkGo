import { useState } from 'react';
import { LocationGate } from '@/components/booking/LocationGate';
import { BookingFlow } from '@/components/booking/BookingFlow';

const Index = () => {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  const handleLocationVerified = (coords: { lat: number; lng: number }) => {
    setUserLocation(coords);
    // Small delay for UX
    setTimeout(() => setIsVerified(true), 1000);
  };

  if (!isVerified || !userLocation) {
    return <LocationGate onLocationVerified={handleLocationVerified} />;
  }

  return <BookingFlow userLocation={userLocation} />;
};

export default Index;
