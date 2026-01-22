import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, useMapEvents } from 'react-leaflet';
import { motion } from 'framer-motion';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Save, RotateCcw, Trash2, Plus, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Fix for default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom vertex icon
const vertexIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [20, 33],
  iconAnchor: [10, 33],
  popupAnchor: [1, -28],
  shadowSize: [33, 33]
});

interface GeofencePoint {
  lat: number;
  lng: number;
}

interface GeofenceData {
  id: string;
  name: string;
  polygon: GeofencePoint[];
  is_active: boolean;
}

interface PolygonEditorProps {
  vertices: GeofencePoint[];
  onVertexMove: (index: number, newPos: GeofencePoint) => void;
  onVertexAdd: (pos: GeofencePoint) => void;
  onVertexRemove: (index: number) => void;
  isEditing: boolean;
}

function PolygonEditor({ vertices, onVertexMove, onVertexAdd, onVertexRemove, isEditing }: PolygonEditorProps) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  useMapEvents({
    click(e) {
      if (isEditing) {
        onVertexAdd({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });

  return (
    <>
      {/* Polygon fill */}
      {vertices.length >= 3 && (
        <Polygon
          positions={vertices.map(v => [v.lat, v.lng] as [number, number])}
          pathOptions={{
            color: 'hsl(168, 72%, 32%)',
            fillColor: 'hsl(168, 72%, 32%)',
            fillOpacity: isEditing ? 0.2 : 0.15,
            weight: isEditing ? 3 : 2,
            dashArray: isEditing ? '5, 10' : undefined
          }}
        />
      )}

      {/* Vertex markers */}
      {isEditing && vertices.map((vertex, index) => (
        <Marker
          key={index}
          position={[vertex.lat, vertex.lng]}
          icon={vertexIcon}
          draggable={true}
          eventHandlers={{
            dragstart: () => setDraggingIndex(index),
            drag: (e) => {
              const marker = e.target;
              const position = marker.getLatLng();
              onVertexMove(index, { lat: position.lat, lng: position.lng });
            },
            dragend: () => setDraggingIndex(null),
            contextmenu: (e) => {
              e.originalEvent.preventDefault();
              if (vertices.length > 3) {
                onVertexRemove(index);
              }
            }
          }}
        />
      ))}
    </>
  );
}

export function GeofenceEditor() {
  const [geofence, setGeofence] = useState<GeofenceData | null>(null);
  const [vertices, setVertices] = useState<GeofencePoint[]>([]);
  const [originalVertices, setOriginalVertices] = useState<GeofencePoint[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Default center (Pilar Village approximate center)
  const defaultCenter: [number, number] = [14.4255, 120.9885];

  useEffect(() => {
    fetchGeofence();
  }, []);

  useEffect(() => {
    // Check if vertices have changed from original
    if (originalVertices.length > 0) {
      const changed = JSON.stringify(vertices) !== JSON.stringify(originalVertices);
      setHasChanges(changed);
    }
  }, [vertices, originalVertices]);

  const fetchGeofence = async () => {
    const { data, error } = await supabase
      .from('geofences')
      .select('*')
      .eq('name', 'Pilar Village')
      .maybeSingle();

    if (data) {
      const geofenceData: GeofenceData = {
        id: data.id,
        name: data.name,
        polygon: data.polygon as unknown as GeofencePoint[],
        is_active: data.is_active ?? true
      };
      setGeofence(geofenceData);
      setVertices(geofenceData.polygon);
      setOriginalVertices(geofenceData.polygon);
    }
  };

  const handleVertexMove = useCallback((index: number, newPos: GeofencePoint) => {
    setVertices(prev => {
      const updated = [...prev];
      updated[index] = newPos;
      return updated;
    });
  }, []);

  const handleVertexAdd = useCallback((pos: GeofencePoint) => {
    setVertices(prev => [...prev, pos]);
  }, []);

  const handleVertexRemove = useCallback((index: number) => {
    setVertices(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleReset = () => {
    setVertices([...originalVertices]);
    toast.info('Geofence reset to original');
  };

  const handleClear = () => {
    setVertices([]);
    toast.info('All vertices cleared - click on map to add new ones');
  };

  const handleSave = async () => {
    if (!geofence || vertices.length < 3) {
      toast.error('Need at least 3 vertices to save');
      return;
    }

    setIsSaving(true);

    const { error } = await supabase
      .from('geofences')
      .update({ polygon: vertices as unknown as any })
      .eq('id', geofence.id);

    setIsSaving(false);

    if (error) {
      toast.error('Failed to save geofence');
      console.error(error);
    } else {
      setOriginalVertices([...vertices]);
      setIsEditing(false);
      toast.success('Geofence saved successfully!');
    }
  };

  const polygonCenter = vertices.length > 0
    ? [
        vertices.reduce((sum, v) => sum + v.lat, 0) / vertices.length,
        vertices.reduce((sum, v) => sum + v.lng, 0) / vertices.length
      ] as [number, number]
    : defaultCenter;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg">Pilar Village Geofence</h2>
          <p className="text-sm text-muted-foreground">
            {isEditing ? 'Click map to add vertices, drag to move, right-click to remove' : 'Visual boundary for allowed pickups'}
          </p>
        </div>
        <div className="flex gap-2">
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)}>
              Edit Boundary
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={handleClear}>
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleReset} disabled={!hasChanges}>
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Button variant="secondary" size="sm" onClick={() => {
                setVertices([...originalVertices]);
                setIsEditing(false);
              }}>
                Cancel
              </Button>
              <Button 
                variant="success" 
                size="sm" 
                onClick={handleSave}
                disabled={isSaving || vertices.length < 3}
              >
                <Save className="w-4 h-4" />
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Info banner when editing */}
      {isEditing && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-start gap-3">
          <Info className="w-5 h-5 text-primary mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-primary">Editing Mode</p>
            <ul className="text-muted-foreground mt-1 space-y-1">
              <li>• <strong>Click</strong> on the map to add a new vertex</li>
              <li>• <strong>Drag</strong> green markers to adjust position</li>
              <li>• <strong>Right-click</strong> a marker to remove it</li>
              <li>• Minimum 3 vertices required to form a boundary</li>
            </ul>
          </div>
        </div>
      )}

      {/* Map */}
      <div className="map-container w-full h-[500px] rounded-xl overflow-hidden border-2 border-border">
        <MapContainer
          center={polygonCenter}
          zoom={16}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <PolygonEditor
            vertices={vertices}
            onVertexMove={handleVertexMove}
            onVertexAdd={handleVertexAdd}
            onVertexRemove={handleVertexRemove}
            isEditing={isEditing}
          />
        </MapContainer>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>Vertices: <strong className="text-foreground">{vertices.length}</strong></span>
        {hasChanges && isEditing && (
          <span className="text-warning font-medium">• Unsaved changes</span>
        )}
      </div>
    </motion.div>
  );
}
