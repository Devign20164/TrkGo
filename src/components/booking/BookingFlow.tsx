import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Navigation, Check, ArrowLeft, Phone, Car, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BookingMap } from './BookingMap';
import { supabase } from '@/integrations/supabase/client';
import { calculateFare, calculateDistance, isPointInPolygon } from '@/lib/geolocation';
import type { GeofencePolygon } from '@/lib/geolocation';

interface Station {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface BookingFlowProps {
  userLocation: { lat: number; lng: number };
}

type BookingStep = 'pickup' | 'dropoff' | 'confirm' | 'searching' | 'matched' | 'complete';

export function BookingFlow({ userLocation }: BookingFlowProps) {
  const [step, setStep] = useState<BookingStep>('pickup');
  const [pickupLocation, setPickupLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [tripType, setTripType] = useState<'village' | 'outbound'>('village');
  const [fare, setFare] = useState(0);
  const [customerPhone, setCustomerPhone] = useState('');
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [assignedDriver, setAssignedDriver] = useState<any>(null);
  const [geofence, setGeofence] = useState<GeofencePolygon[]>([]);
  const [stations, setStations] = useState<Station[]>([]);

  useEffect(() => {
    async function fetchData() {
      const { data: geoData } = await supabase
        .from('geofences')
        .select('polygon')
        .eq('is_active', true)
        .single();
      
      if (geoData?.polygon) {
        setGeofence(geoData.polygon as unknown as GeofencePolygon[]);
      }

      const { data: stationData } = await supabase
        .from('stations')
        .select('*')
        .eq('is_active', true);
      
      if (stationData) {
        setStations(stationData);
      }
    }
    
    fetchData();
  }, []);

  // Calculate fare when locations change
  useEffect(() => {
    if (pickupLocation && dropoffLocation) {
      const distance = calculateDistance(pickupLocation, dropoffLocation);
      const calculatedFare = calculateFare(tripType, distance);
      setFare(calculatedFare);
    }
  }, [pickupLocation, dropoffLocation, tripType]);

  // Subscribe to booking updates
  useEffect(() => {
    if (!bookingId) return;

    const channel = supabase
      .channel(`booking-${bookingId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${bookingId}`
        },
        async (payload) => {
          const booking = payload.new as any;
          if (booking.status === 'accepted' && booking.driver_id) {
            // Fetch driver details
            const { data: driver } = await supabase
              .from('drivers')
              .select('*')
              .eq('id', booking.driver_id)
              .single();
            
            if (driver) {
              setAssignedDriver(driver);
              setStep('matched');
            }
          } else if (booking.status === 'completed') {
            setStep('complete');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId]);

  const handlePickupSelect = (coords: { lat: number; lng: number }) => {
    // Validate pickup is inside geofence
    if (!isPointInPolygon(coords, geofence)) {
      alert('Pickup must be inside Pilar Village');
      return;
    }
    setPickupLocation(coords);
    setStep('dropoff');
  };

  const handleDropoffSelect = (coords: { lat: number; lng: number }, stationId?: string) => {
    setDropoffLocation(coords);
    
    // Check if dropoff is a station
    if (stationId) {
      const station = stations.find(s => s.id === stationId);
      if (station) {
        setSelectedStation(station);
        setTripType('outbound');
      }
    } else {
      // Check if dropoff is inside geofence (village trip)
      if (isPointInPolygon(coords, geofence)) {
        setTripType('village');
        setSelectedStation(null);
      } else {
        // Outside but not a station - still outbound
        setTripType('outbound');
        setSelectedStation(null);
      }
    }
    
    setStep('confirm');
  };

  const handleConfirmBooking = async () => {
    if (!pickupLocation || !dropoffLocation) return;

    setStep('searching');

    // Create booking
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        customer_phone: customerPhone || null,
        pickup_latitude: pickupLocation.lat,
        pickup_longitude: pickupLocation.lng,
        dropoff_latitude: dropoffLocation.lat,
        dropoff_longitude: dropoffLocation.lng,
        station_id: selectedStation?.id || null,
        trip_type: tripType,
        fare: fare,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Booking error:', error);
      alert('Failed to create booking. Please try again.');
      setStep('confirm');
      return;
    }

    setBookingId(booking.id);
  };

  const handleCallDriver = () => {
    if (assignedDriver?.mobile_number) {
      window.location.href = `tel:${assignedDriver.mobile_number}`;
    }
  };

  const handleNewBooking = () => {
    setStep('pickup');
    setPickupLocation(null);
    setDropoffLocation(null);
    setSelectedStation(null);
    setBookingId(null);
    setAssignedDriver(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-primary text-primary-foreground p-4 sticky top-0 z-50">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          {step !== 'pickup' && step !== 'searching' && step !== 'matched' && step !== 'complete' && (
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => {
                if (step === 'dropoff') setStep('pickup');
                else if (step === 'confirm') setStep('dropoff');
              }}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div>
            <h1 className="font-bold text-lg">TrikGo</h1>
            <p className="text-sm text-primary-foreground/80">
              {step === 'pickup' && 'Select pickup point'}
              {step === 'dropoff' && 'Select drop-off point'}
              {step === 'confirm' && 'Confirm booking'}
              {step === 'searching' && 'Finding driver...'}
              {step === 'matched' && 'Driver assigned!'}
              {step === 'complete' && 'Ride complete'}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto pb-24">
        <AnimatePresence mode="wait">
          {/* Map View - Pickup & Dropoff */}
          {(step === 'pickup' || step === 'dropoff') && (
            <motion.div
              key="map"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <BookingMap
                userLocation={userLocation}
                pickupLocation={pickupLocation}
                dropoffLocation={dropoffLocation}
                onPickupSelect={handlePickupSelect}
                onDropoffSelect={handleDropoffSelect}
                mode={step}
              />
              
              {/* Instructions */}
              <div className="p-4">
                <div className="bg-card rounded-xl p-4 shadow-md">
                  {step === 'pickup' ? (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-success" />
                      </div>
                      <div>
                        <p className="font-medium">Tap to set pickup</p>
                        <p className="text-sm text-muted-foreground">Must be inside Pilar Village</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                        <Navigation className="w-5 h-5 text-destructive" />
                      </div>
                      <div>
                        <p className="font-medium">Set drop-off location</p>
                        <p className="text-sm text-muted-foreground">Tap map or select a station (orange)</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Confirmation View */}
          {step === 'confirm' && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-4 space-y-4"
            >
              {/* Trip Summary */}
              <div className="bg-card rounded-xl p-4 shadow-md space-y-4">
                <h2 className="font-semibold text-lg">Trip Summary</h2>
                
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center mt-0.5">
                      <MapPin className="w-4 h-4 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pickup</p>
                      <p className="font-medium">Inside Pilar Village</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center mt-0.5">
                      <Navigation className="w-4 h-4 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Drop-off</p>
                      <p className="font-medium">
                        {selectedStation ? selectedStation.name : (tripType === 'village' ? 'Inside Pilar Village' : 'Outside Village')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Trip Type Badge */}
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                  tripType === 'village' 
                    ? 'bg-primary/10 text-primary' 
                    : 'bg-accent/10 text-accent'
                }`}>
                  <Car className="w-4 h-4" />
                  {tripType === 'village' ? 'Village Trip' : 'Outbound Trip'}
                </div>
              </div>

              {/* Fare Card */}
              <div className="bg-gradient-accent rounded-xl p-4 text-accent-foreground">
                <p className="text-sm opacity-90">Estimated Fare</p>
                <p className="text-3xl font-bold">₱{fare.toFixed(2)}</p>
                <p className="text-sm opacity-80 mt-1">Cash payment only</p>
              </div>

              {/* Phone Number */}
              <div className="bg-card rounded-xl p-4 shadow-md">
                <Label htmlFor="phone" className="text-sm text-muted-foreground">
                  Phone Number (optional)
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="09XX XXX XXXX"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Driver can contact you if needed
                </p>
              </div>

              {/* Confirm Button */}
              <Button 
                variant="hero" 
                size="xl" 
                className="w-full"
                onClick={handleConfirmBooking}
              >
                <Check className="w-5 h-5" />
                Confirm Booking
              </Button>
            </motion.div>
          )}

          {/* Searching View */}
          {step === 'searching' && (
            <motion.div
              key="searching"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8 text-center"
            >
              <div className="w-24 h-24 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-6 animate-pulse-slow">
                <Car className="w-12 h-12 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Finding a Driver</h2>
              <p className="text-muted-foreground mb-4">
                Please wait while we find a driver for your trip...
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Usually takes 1-3 minutes</span>
              </div>
            </motion.div>
          )}

          {/* Matched View */}
          {step === 'matched' && assignedDriver && (
            <motion.div
              key="matched"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 space-y-4"
            >
              <div className="bg-success/10 rounded-xl p-4 text-center">
                <Check className="w-8 h-8 text-success mx-auto mb-2" />
                <h2 className="font-semibold text-success">Driver Found!</h2>
              </div>

              {/* Driver Card */}
              <div className="bg-card rounded-xl p-4 shadow-md">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <Car className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{assignedDriver.full_name}</h3>
                    <p className="text-muted-foreground">{assignedDriver.toda_association}</p>
                    <p className="font-medium text-primary">Body #{assignedDriver.body_number}</p>
                  </div>
                </div>

                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={handleCallDriver}
                >
                  <Phone className="w-4 h-4" />
                  Call Driver
                </Button>
              </div>

              {/* Fare Reminder */}
              <div className="bg-gradient-accent rounded-xl p-4 text-accent-foreground text-center">
                <p className="text-sm opacity-90">Prepare Cash Payment</p>
                <p className="text-2xl font-bold">₱{fare.toFixed(2)}</p>
              </div>
            </motion.div>
          )}

          {/* Complete View */}
          {step === 'complete' && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-8 text-center"
            >
              <div className="w-24 h-24 mx-auto bg-success/10 rounded-full flex items-center justify-center mb-6">
                <Check className="w-12 h-12 text-success" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Ride Complete!</h2>
              <p className="text-muted-foreground mb-6">
                Thank you for using TrikGo
              </p>
              <Button variant="hero" size="lg" onClick={handleNewBooking}>
                Book Another Ride
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
