import React, { useState, useEffect } from 'react';
import { User, Booking } from '../types';
import { Icons } from '../constants';
import { uberService } from '../services/uberService';
import { MapContainer as LeafletMap, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

export const UberRequestScreen = ({
  user,
  onBack,
  onRideAccepted
}: {
  user: User;
  onBack: () => void;
  onRideAccepted: (booking: any) => void;
}) => {
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [status, setStatus] = useState<'IDLE' | 'SEARCHING' | 'ACCEPTED'>('IDLE');
  const [currentCoords, setCurrentCoords] = useState<{lat: number, lng: number}>({ lat: 10.8505, lng: 76.2711 });
  const [isLocating, setIsLocating] = useState(false);
  const [rideRequest, setRideRequest] = useState<any>(null);

  useEffect(() => {
    fetchCurrentLocation();
  }, []);

  useEffect(() => {
    if (status === 'SEARCHING' && rideRequest) {
      const unsub = uberService.listenToMyRideRequests(user.id, (payload) => {
        if (payload.status === 'ACCEPTED' && payload.driver_id) {
          setStatus('ACCEPTED');
          // In a real app we would create a full Booking object here, but for now we pass a mock mapping
          onRideAccepted({
            id: payload.id,
            tripId: 'uber-' + payload.id,
            riderId: user.id,
            seats: 1,
            totalPrice: payload.estimated_fare,
            status: 'CONFIRMED',
            from: payload.pickup_address,
            to: payload.dropoff_address,
            ownerName: 'Your Driver', // Normally we fetch the driver's info
            createdAt: new Date().toISOString()
          });
        }
      });
      return () => unsub();
    }
  }, [status, rideRequest]);

  const fetchCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentCoords({ lat: latitude, lng: longitude });
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await response.json();
          if (data && data.display_name) {
            const parts = data.display_name.split(',');
            setPickup(parts[0] + (parts[1] ? ', ' + parts[1] : ''));
          }
        } catch (e) {}
        setIsLocating(false);
      },
      () => setIsLocating(false),
      { enableHighAccuracy: true }
    );
  };

  const requestRide = async () => {
    try {
      setStatus('SEARCHING');
      const req = await uberService.requestRide(
        user.id,
        currentCoords.lat,
        currentCoords.lng,
        currentCoords.lat + 0.01, // Mock dropoff coords
        currentCoords.lng + 0.01,
        pickup,
        dropoff,
        Math.floor(Math.random() * 300) + 100 // Random fare ₹100-400
      );
      setRideRequest(req);
    } catch (e: any) {
      alert("Failed to request ride: " + e.message);
      setStatus('IDLE');
    }
  };

  return (
    <div className="h-full flex flex-col relative bg-app">
      {/* Map Background */}
      <div className="absolute inset-0 z-0">
        <LeafletMap 
          center={[currentCoords.lat, currentCoords.lng]} 
          zoom={15} 
          zoomControl={false} 
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
          <Marker position={[currentCoords.lat, currentCoords.lng]}>
             <Popup>You are here</Popup>
          </Marker>
        </LeafletMap>
      </div>

      {/* Top Header */}
      <div className="relative z-10 p-6 flex justify-between items-center pointer-events-none">
        <button onClick={onBack} className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center pointer-events-auto active:scale-95 transition-all text-main border border-subtle">
           ←
        </button>
      </div>

      <div className="flex-1"></div>

      {/* Bottom Sheet */}
      <div className="relative z-10 bg-white rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] p-8 space-y-6 border-t border-subtle">
         <div className="w-12 h-1.5 bg-subtle rounded-full mx-auto mb-4"></div>
         
         {status === 'IDLE' && (
           <div className="space-y-4 animate-in slide-in-from-bottom-4">
              <h2 className="text-3xl font-black italic uppercase text-main">Ride Now</h2>
              <div className="space-y-4 relative">
                 <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-subtle z-0"></div>
                 <div className="relative z-10">
                   <div className="flex items-center gap-4">
                     <div className="w-3 h-3 bg-emerald-500 rounded-full border-2 border-white shadow-sm flex-shrink-0"></div>
                     <input value={pickup} onChange={e => setPickup(e.target.value)} placeholder="Pickup Location" className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-sm outline-none border border-transparent focus:border-[#16A34A]" />
                   </div>
                 </div>
                 <div className="relative z-10">
                   <div className="flex items-center gap-4">
                     <div className="w-3 h-3 bg-black rounded-sm border-2 border-white shadow-sm flex-shrink-0"></div>
                     <input value={dropoff} onChange={e => setDropoff(e.target.value)} placeholder="Where to?" className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-sm outline-none border border-transparent focus:border-[#16A34A]" />
                   </div>
                 </div>
              </div>
              <button onClick={requestRide} disabled={!pickup || !dropoff} className="w-full bg-main text-white py-6 rounded-[30px] font-black text-xs uppercase tracking-widest shadow-2xl mt-4 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                 Request Private Car
              </button>
           </div>
         )}

         {status === 'SEARCHING' && (
           <div className="space-y-6 text-center animate-in slide-in-from-bottom-4 py-8">
              <div className="w-24 h-24 bg-emerald-50 rounded-full mx-auto flex items-center justify-center relative">
                 <div className="absolute inset-0 border-4 border-emerald-500 rounded-full animate-ping opacity-20"></div>
                 <Icons.Search className="w-10 h-10 text-emerald-600 animate-pulse" />
              </div>
              <div className="space-y-2">
                 <h2 className="text-2xl font-black italic uppercase text-main">Connecting...</h2>
                 <p className="text-muted text-[10px] font-bold uppercase tracking-widest">Searching for nearby drivers</p>
              </div>
              <button onClick={() => setStatus('IDLE')} className="w-full bg-rose-50 text-rose-500 py-4 rounded-[24px] font-black text-[10px] uppercase tracking-widest mt-4">
                 Cancel Request
              </button>
           </div>
         )}
      </div>
    </div>
  );
};
