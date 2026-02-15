
import React, { useEffect, useRef, useState } from 'react';
import { User, Booking, LiveLocation } from '../types';
import { locationService } from '../services/firebaseService';
import { Icons } from '../constants';

declare const L: any;

interface Props {
  user: User;
  booking: Booking;
  onBack: () => void;
}

export const LiveTrackingScreen: React.FC<Props> = ({ user, booking, onBack }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletInstance = useRef<any>(null);
  const userMarker = useRef<any>(null);
  const driverMarker = useRef<any>(null);
  const polyline = useRef<any>(null);

  const [driverLocation, setDriverLocation] = useState<LiveLocation | null>(null);
  const [userLocation, setUserLocation] = useState<LiveLocation | null>(null);

  useEffect(() => {
    // 1. Start watching user's own location
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        locationService.updateUserLocation(user.id, loc);
      },
      (err) => console.error("Geolocation error:", err),
      { enableHighAccuracy: true }
    );

    // 2. Listen to driver's location
    const unsubscribe = locationService.listenToUserLocation(booking.driverId, (loc) => {
      if (loc) setDriverLocation(loc);
    });

    return () => {
      navigator.geolocation.clearWatch(watchId);
      unsubscribe();
    };
  }, [user.id, booking.driverId]);

  useEffect(() => {
    if (mapRef.current && !leafletInstance.current && typeof L !== 'undefined') {
      leafletInstance.current = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView([10.8505, 76.2711], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(leafletInstance.current);
    }
  }, []);

  useEffect(() => {
    if (!leafletInstance.current || typeof L === 'undefined') return;

    // Update User Marker
    if (userLocation) {
      if (!userMarker.current) {
        userMarker.current = L.marker([userLocation.lat, userLocation.lng], {
          icon: L.divIcon({ 
            className: 'user-marker', 
            html: `<div class="w-8 h-8 bg-blue-500 rounded-full border-4 border-white shadow-xl flex items-center justify-center text-white"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>`, 
            iconSize: [32, 32] 
          })
        }).addTo(leafletInstance.current).bindPopup("You");
      } else {
        userMarker.current.setLatLng([userLocation.lat, userLocation.lng]);
      }
    }

    // Update Driver Marker
    if (driverLocation) {
      if (!driverMarker.current) {
        driverMarker.current = L.marker([driverLocation.lat, driverLocation.lng], {
          icon: L.divIcon({ 
            className: 'driver-marker', 
            html: `<div class="w-10 h-10 bg-emerald-500 rounded-full border-4 border-white shadow-xl flex items-center justify-center text-white animate-bounce"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg></div>`, 
            iconSize: [40, 40] 
          })
        }).addTo(leafletInstance.current).bindPopup(booking.ownerName);
      } else {
        driverMarker.current.setLatLng([driverLocation.lat, driverLocation.lng]);
      }
    }

    // Update Route Line
    if (userLocation && driverLocation) {
      if (polyline.current) polyline.current.remove();
      polyline.current = L.polyline([[userLocation.lat, userLocation.lng], [driverLocation.lat, driverLocation.lng]], { 
        color: '#10b981', 
        weight: 4, 
        dashArray: '10, 10', 
        opacity: 0.6 
      }).addTo(leafletInstance.current);

      const bounds = L.latLngBounds([
        [userLocation.lat, userLocation.lng],
        [driverLocation.lat, driverLocation.lng]
      ]);
      leafletInstance.current.fitBounds(bounds, { padding: [100, 100] });
    } else if (userLocation) {
      leafletInstance.current.setView([userLocation.lat, userLocation.lng], 15);
    }
  }, [userLocation, driverLocation]);

  return (
    <div className="h-full flex flex-col relative bg-surface-alt">
      <div ref={mapRef} className="flex-1 z-0" />
      
      <div className="absolute top-6 left-6 right-6 z-10 flex items-center justify-between">
        <button 
          onClick={onBack} 
          className="bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-2xl border border-subtle text-main active:scale-95 transition-all"
        >
          ←
        </button>
        <div className="bg-white/90 backdrop-blur-md px-6 py-4 rounded-3xl shadow-2xl border border-subtle flex items-center gap-3">
          <img src={booking.ownerAvatar} className="w-8 h-8 rounded-full border border-subtle" />
          <div>
            <p className="text-[10px] font-black uppercase text-main leading-none">{booking.ownerName}</p>
            <p className="text-[8px] font-bold text-emerald-600 uppercase tracking-widest mt-1">Driving to you</p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-10 left-6 right-6 z-10">
        <div className="bg-white/90 backdrop-blur-xl p-8 rounded-[40px] shadow-2xl border border-subtle space-y-6">
          <div className="flex justify-between items-center">
             <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-muted tracking-widest">ETA</p>
                <p className="text-2xl font-black text-main italic">~ 8 Mins</p>
             </div>
             <div className="bg-emerald-100 px-4 py-2 rounded-2xl text-emerald-600 font-black text-[10px] uppercase tracking-widest">
                On Track
             </div>
          </div>
          
          <div className="flex gap-3">
            <button className="flex-1 bg-surface-alt py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-subtle hover:bg-subtle transition-all">
                Emergency
            </button>
            <button className="flex-1 bg-[var(--color-primary)] text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95 transition-all">
                Call Driver
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
