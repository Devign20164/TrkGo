import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, MapPin, Car, Check, X, Shield, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { GeofenceEditor } from '@/components/admin/GeofenceEditor';

const AdminDashboard = () => {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'drivers' | 'stations' | 'geofence'>('drivers');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [driversRes, stationsRes] = await Promise.all([
      supabase.from('drivers').select('*').order('created_at', { ascending: false }),
      supabase.from('stations').select('*')
    ]);
    if (driversRes.data) setDrivers(driversRes.data);
    if (stationsRes.data) setStations(stationsRes.data);
  };

  const updateDriverStatus = async (id: string, status: 'approved' | 'rejected') => {
    await supabase.from('drivers').update({ status }).eq('id', id);
    fetchData();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-sidebar text-sidebar-foreground p-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Shield className="w-8 h-8 text-sidebar-primary" />
          <div>
            <h1 className="font-bold text-lg">TrikGo Admin</h1>
            <p className="text-sm opacity-70">Management Dashboard</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4">
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <Button 
            variant={activeTab === 'drivers' ? 'default' : 'secondary'} 
            onClick={() => setActiveTab('drivers')}
          >
            <Users className="w-4 h-4" /> Drivers
          </Button>
          <Button 
            variant={activeTab === 'stations' ? 'default' : 'secondary'} 
            onClick={() => setActiveTab('stations')}
          >
            <MapPin className="w-4 h-4" /> Stations
          </Button>
          <Button 
            variant={activeTab === 'geofence' ? 'default' : 'secondary'} 
            onClick={() => setActiveTab('geofence')}
          >
            <Map className="w-4 h-4" /> Geofence
          </Button>
        </div>

        {/* Drivers Tab */}
        {activeTab === 'drivers' && (
          <div className="space-y-4">
            <h2 className="font-semibold">
              Driver Applications ({drivers.filter(d => d.status === 'pending').length} pending)
            </h2>
            {drivers.length === 0 ? (
              <div className="bg-card rounded-xl p-8 text-center text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No driver applications yet</p>
              </div>
            ) : (
              drivers.map(driver => (
                <motion.div 
                  key={driver.id} 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  className="bg-card rounded-xl p-4 shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{driver.full_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {driver.toda_association} • Body #{driver.body_number}
                      </p>
                      <p className="text-sm">{driver.mobile_number}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                      driver.status === 'pending' 
                        ? 'status-pending' 
                        : driver.status === 'approved' 
                          ? 'status-approved' 
                          : 'status-rejected'
                    }`}>
                      {driver.status}
                    </span>
                  </div>
                  {driver.status === 'pending' && (
                    <div className="flex gap-2 mt-4">
                      <Button 
                        variant="success" 
                        size="sm" 
                        onClick={() => updateDriverStatus(driver.id, 'approved')}
                      >
                        <Check className="w-4 h-4" /> Approve
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => updateDriverStatus(driver.id, 'rejected')}
                      >
                        <X className="w-4 h-4" /> Reject
                      </Button>
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* Stations Tab */}
        {activeTab === 'stations' && (
          <div className="space-y-4">
            <h2 className="font-semibold">Approved Stations ({stations.length})</h2>
            {stations.length === 0 ? (
              <div className="bg-card rounded-xl p-8 text-center text-muted-foreground">
                <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No stations configured</p>
              </div>
            ) : (
              stations.map(station => (
                <div 
                  key={station.id} 
                  className="bg-card rounded-xl p-4 shadow-md flex items-center gap-3"
                >
                  <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-medium">{station.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {station.latitude.toFixed(4)}, {station.longitude.toFixed(4)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Geofence Tab */}
        {activeTab === 'geofence' && <GeofenceEditor />}
      </div>
    </div>
  );
};

export default AdminDashboard;