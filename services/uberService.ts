import { supabase } from './supabaseClient';

export const uberService = {
  goOnline: async (driverId: string, lat: number, lng: number) => {
    await supabase.from('driver_locations').upsert({
      driver_id: driverId,
      location: `SRID=4326;POINT(${lng} ${lat})`,
      status: 'ONLINE',
      updated_at: new Date().toISOString()
    });
  },
  
  goOffline: async (driverId: string) => {
    await supabase.from('driver_locations').update({
      status: 'OFFLINE',
      updated_at: new Date().toISOString()
    }).eq('driver_id', driverId);
  },

  updateLocation: async (driverId: string, lat: number, lng: number, heading?: number, speed?: number) => {
    await supabase.from('driver_locations').update({
      location: `SRID=4326;POINT(${lng} ${lat})`,
      heading: heading || 0,
      speed: speed || 0,
      updated_at: new Date().toISOString()
    }).eq('driver_id', driverId);
  },

  requestRide: async (riderId: string, pickupLat: number, pickupLng: number, dropoffLat: number, dropoffLng: number, pickupAddr: string, dropoffAddr: string, estimatedFare: number) => {
    const { data, error } = await supabase.from('ride_requests').insert({
      rider_id: riderId,
      pickup_location: `SRID=4326;POINT(${pickupLng} ${pickupLat})`,
      pickup_address: pickupAddr,
      dropoff_location: `SRID=4326;POINT(${dropoffLng} ${dropoffLat})`,
      dropoff_address: dropoffAddr,
      estimated_fare: estimatedFare,
      status: 'SEARCHING'
    }).select().single();
    
    if (error) throw error;
    return data;
  },

  acceptRide: async (requestId: string, driverId: string) => {
    const { data, error } = await supabase.from('ride_requests').update({
      driver_id: driverId,
      status: 'ACCEPTED',
      updated_at: new Date().toISOString()
    }).eq('id', requestId).eq('status', 'SEARCHING').select().single();
    
    if (error) throw error;
    return data;
  },
  
  listenToMyRideRequests: (riderId: string, callback: (request: any) => void) => {
    const channel = supabase.channel(`public:ride_requests:rider_id=eq.${riderId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ride_requests', filter: `rider_id=eq.${riderId}` }, payload => {
        callback(payload.new);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  },

  listenToNearbyRequests: (callback: (request: any) => void) => {
    const channel = supabase.channel(`public:ride_requests:status=eq.SEARCHING`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ride_requests', filter: `status=eq.SEARCHING` }, payload => {
        callback(payload.new);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }
};
