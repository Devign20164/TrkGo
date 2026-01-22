import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMapEvents } from 'react-leaflet';
import { motion } from 'framer-motion';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';
import type { GeofencePolygon } from '@/lib/geolocation';

// Fix for default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons
const pickupIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const dropoffIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const stationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface Station {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface BookingMapProps {
  userLocation: { lat: number; lng: number };
  pickupLocation: { lat: number; lng: number } | null;
  dropoffLocation: { lat: number; lng: number } | null;
  onPickupSelect: (coords: { lat: number; lng: number }) => void;
  onDropoffSelect: (coords: { lat: number; lng: number }, stationId?: string) => void;
  mode: 'pickup' | 'dropoff';
}

function MapClickHandler({ 
  mode, 
  onPickupSelect, 
  onDropoffSelect, 
  geofence 
}: { 
  mode: 'pickup' | 'dropoff';
  onPickupSelect: (coords: { lat: number; lng: number }) => void;
  onDropoffSelect: (coords: { lat: number; lng: number }) => void;
  geofence: GeofencePolygon[];
}) {
  useMapEvents({
    click(e) {
      const coords = { lat: e.latlng.lat, lng: e.latlng.lng };
      
      if (mode === 'pickup') {
        // For pickup, must be inside geofence
        onPickupSelect(coords);
      } else {
        // For dropoff, can be inside geofence (village trip)
        onDropoffSelect(coords);
      }
    },
  });
  
  return null;
}

export function BookingMap({ 
  userLocation, 
  pickupLocation, 
  dropoffLocation, 
  onPickupSelect, 
  onDropoffSelect,
  mode 
}: BookingMapProps) {
  const [geofence, setGeofence] = useState<GeofencePolygon[]>([]);
  const [stations, setStations] = useState<Station[]>([]);

  useEffect(() => {
    async function fetchData() {
      // Fetch geofence
      const { data: geoData } = await supabase
        .from('geofences')
        .select('polygon')
        .eq('is_active', true)
        .single();
      
      if (geoData?.polygon) {
        setGeofence(geoData.polygon as unknown as GeofencePolygon[]);
      }

      // Fetch stations
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

  const polygonPositions = geofence.map(p => [p.lat, p.lng] as [number, number]);

  return (
    <motion.div 
      className="map-container w-full h-[400px] md:h-[500px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <MapContainer
        center={[userLocation.lat, userLocation.lng]}
        zoom={16}
        style={{ height: '100%', width: '100%' }}
        className="rounded-xl"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Geofence polygon */}
        {polygonPositions.length > 0 && (
          <Polygon 
            positions={polygonPositions}
            pathOptions={{ 
              color: 'hsl(168, 72%, 32%)', 
              fillColor: 'hsl(168, 72%, 32%)',
              fillOpacity: 0.1,
              weight: 2
            }}
          />
        )}

        {/* User location marker */}
        <Marker position={[userLocation.lat, userLocation.lng]}>
          <Popup>Your Location</Popup>
        </Marker>

        {/* Pickup marker */}
        {pickupLocation && (
          <Marker position={[pickupLocation.lat, pickupLocation.lng]} icon={pickupIcon}>
            <Popup>Pickup Point</Popup>
          </Marker>
        )}

        {/* Dropoff marker */}
        {dropoffLocation && (
          <Marker position={[dropoffLocation.lat, dropoffLocation.lng]} icon={dropoffIcon}>
            <Popup>Drop-off Point</Popup>
          </Marker>
        )}

        {/* Station markers (only show during dropoff selection) */}
        {mode === 'dropoff' && stations.map(station => (
          <Marker 
            key={station.id}
            position={[station.latitude, station.longitude]} 
            icon={stationIcon}
            eventHandlers={{
              click: () => onDropoffSelect({ lat: station.latitude, lng: station.longitude }, station.id)
            }}
          >
            <Popup>
              <strong>{station.name}</strong>
              <br />
              <span className="text-sm text-muted-foreground">Tap to select as drop-off</span>
            </Popup>
          </Marker>
        ))}

        <MapClickHandler 
          mode={mode}
          onPickupSelect={onPickupSelect}
          onDropoffSelect={(coords) => onDropoffSelect(coords)}
          geofence={geofence}
        />
      </MapContainer>
    </motion.div>
  );
}
