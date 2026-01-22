import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Car, MapPin, Navigation, Check, X, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

const DriverDashboard = () => {
  const [isOnline, setIsOnline] = useState(false);
  const [pendingBookings, setPendingBookings] = useState<any[]>([]);

  useEffect(() => {
    const channel = supabase.channel('bookings').on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
      fetchBookings();
    }).subscribe();
    fetchBookings();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchBookings = async () => {
    const { data } = await supabase.from('bookings').select('*').eq('status', 'pending').order('created_at', { ascending: false });
    if (data) setPendingBookings(data);
  };

  const acceptBooking = async (bookingId: string) => {
    // For demo, using a placeholder driver ID
    await supabase.from('bookings').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', bookingId);
    fetchBookings();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-primary text-primary-foreground p-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <Car className="w-8 h-8" />
            <div><h1 className="font-bold">Driver Dashboard</h1><p className="text-sm opacity-80">TrikGo</p></div>
          </div>
          <Button variant={isOnline ? 'success' : 'secondary'} size="sm" onClick={() => setIsOnline(!isOnline)}>
            <Power className="w-4 h-4" /> {isOnline ? 'Online' : 'Offline'}
          </Button>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4">
        {!isOnline ? (
          <div className="text-center py-12 text-muted-foreground">
            <Power className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Go online to receive ride requests</p>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="font-semibold">Pending Requests ({pendingBookings.length})</h2>
            {pendingBookings.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No pending requests</p>
            ) : (
              pendingBookings.map(booking => (
                <motion.div key={booking.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-4 shadow-md">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${booking.trip_type === 'village' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'}`}>
                      {booking.trip_type === 'village' ? 'Village Trip' : 'Outbound'}
                    </span>
                    <span className="ml-auto font-bold text-lg">₱{booking.fare}</span>
                  </div>
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-success" /> Pickup inside village</div>
                    <div className="flex items-center gap-2"><Navigation className="w-4 h-4 text-destructive" /> {booking.station_id ? 'Station' : 'Village'}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="hero" className="flex-1" onClick={() => acceptBooking(booking.id)}><Check className="w-4 h-4" /> Accept</Button>
                    <Button variant="outline" size="icon"><X className="w-4 h-4" /></Button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default DriverDashboard;