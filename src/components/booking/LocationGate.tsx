import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGeolocation } from '@/hooks/useGeolocation';
import { supabase } from '@/integrations/supabase/client';
import type { GeofencePolygon } from '@/lib/geolocation';

interface LocationGateProps {
  onLocationVerified: (coords: { lat: number; lng: number }) => void;
}

export function LocationGate({ onLocationVerified }: LocationGateProps) {
  const [geofence, setGeofence] = useState<GeofencePolygon[]>([]);
  const { coordinates, isLoading, error, isInsideGeofence, checkLocation } = useGeolocation();

  useEffect(() => {
    // Fetch geofence from database
    async function fetchGeofence() {
      const { data } = await supabase
        .from('geofences')
        .select('polygon')
        .eq('is_active', true)
        .eq('name', 'Pilar Village')
        .single();
      
      if (data?.polygon) {
        setGeofence(data.polygon as unknown as GeofencePolygon[]);
      }
    }
    
    fetchGeofence();
  }, []);

  const handleCheckLocation = async () => {
    const inside = await checkLocation(geofence);
    if (inside && coordinates) {
      onLocationVerified(coordinates);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col items-center justify-center p-6 text-primary-foreground">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center"
      >
        {/* Logo */}
        <motion.div 
          className="mb-8"
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
        >
          <div className="w-20 h-20 mx-auto bg-primary-foreground/20 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm">
            <MapPin className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold mb-2">TrikGo</h1>
          <p className="text-primary-foreground/80 text-lg">Pilar Village Tricycle Booking</p>
        </motion.div>

        {/* Status Card */}
        <motion.div 
          className="glass-card rounded-2xl p-6 bg-card/95 text-card-foreground mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <AnimatePresence mode="wait">
            {!coordinates && !isLoading && (
              <motion.div
                key="initial"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <h2 className="text-xl font-semibold mb-3">Welcome!</h2>
                <p className="text-muted-foreground mb-6">
                  To book a tricycle, we need to verify you're inside Pilar Village.
                </p>
                <Button 
                  variant="hero" 
                  size="xl" 
                  className="w-full"
                  onClick={handleCheckLocation}
                  disabled={geofence.length === 0}
                >
                  <MapPin className="w-5 h-5" />
                  Get My Location
                </Button>
              </motion.div>
            )}

            {isLoading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-8"
              >
                <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Checking your location...</p>
              </motion.div>
            )}

            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8 text-destructive" />
                </div>
                <h2 className="text-xl font-semibold mb-2 text-destructive">Location Error</h2>
                <p className="text-muted-foreground mb-6">{error}</p>
                <Button variant="outline" onClick={handleCheckLocation} className="w-full">
                  Try Again
                </Button>
              </motion.div>
            )}

            {coordinates && isInsideGeofence === false && (
              <motion.div
                key="outside"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="w-16 h-16 mx-auto bg-warning/10 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8 text-warning" />
                </div>
                <h2 className="text-xl font-semibold mb-2 text-warning">Outside Pilar Village</h2>
                <p className="text-muted-foreground mb-6">
                  You're currently outside Pilar Village. Bookings are only available for trips starting inside the village.
                </p>
                <Button variant="outline" onClick={handleCheckLocation} className="w-full">
                  Check Again
                </Button>
              </motion.div>
            )}

            {coordinates && isInsideGeofence === true && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="w-16 h-16 mx-auto bg-success/10 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-success" />
                </div>
                <h2 className="text-xl font-semibold mb-2 text-success">Location Verified!</h2>
                <p className="text-muted-foreground">Redirecting to booking...</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Footer links */}
        <motion.div 
          className="flex gap-4 justify-center text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <a href="/driver" className="text-primary-foreground/80 hover:text-primary-foreground underline underline-offset-4">
            I'm a Driver
          </a>
          <span className="text-primary-foreground/40">•</span>
          <a href="/admin" className="text-primary-foreground/80 hover:text-primary-foreground underline underline-offset-4">
            Admin Login
          </a>
        </motion.div>
      </motion.div>
    </div>
  );
}
