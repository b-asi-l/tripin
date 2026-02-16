
import React, { useState, useEffect, useRef } from 'react';
import { 
  ViewState, 
  Trip, 
  VehicleType, 
  TripStatus, 
  User,
  Booking
} from './types';
import { Icons, KERALA_LOCATIONS } from './constants';
import { authService, tripService, adminService, userService, bookingService, locationService } from './services/firebaseService';
import { generateTripDescription, suggestTripPrice } from './services/geminiService';
import { PaymentScreen } from './components/PaymentScreen';
import { ReceiptScreen } from './components/ReceiptScreen';
import { AdminKYCPanel } from './screens/AdminKYCPanel';
import { CustomerKYC } from './screens/CustomerKYC';
import { DriverKYC } from './screens/DriverKYC';
import { ChatScreen } from './screens/ChatScreen';
import { TopUpScreen } from './screens/TopUpScreen';
import { LiveTrackingScreen } from './screens/LiveTrackingScreen';
import { ProfileSetup } from './screens/ProfileSetup';
import { EarningsScreen } from './screens/EarningsScreen';

declare const L: any;

/**
 * Enhanced Location Input with OpenStreetMap Autocomplete
 */
const LocationInput = ({ 
  label, 
  placeholder, 
  value, 
  onChange, 
  onUseCurrentLocation,
  isLocating 
}: { 
  label: string, 
  placeholder: string, 
  value: string, 
  onChange: (v: string, lat?: number, lon?: number) => void,
  onUseCurrentLocation?: () => void,
  isLocating?: boolean
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<any>(null);

  // Search OSM Nominatim when typing
  useEffect(() => {
    if (value.length > 3) {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      searchTimeout.current = setTimeout(async () => {
        setSearching(true);
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value + ', Kerala')}&limit=5`);
          const data = await res.json();
          setSuggestions(data);
        } catch (e) {
          console.error("OSM Search failed", e);
        } finally {
          setSearching(false);
        }
      }, 500);
    } else {
      setSuggestions([]);
    }
  }, [value]);

  return (
    <div className="space-y-2 relative" ref={containerRef}>
      <label className="text-[10px] font-black uppercase text-muted ml-4 tracking-widest">{label}</label>
      <div className="relative">
        <input 
          value={value}
          onChange={(e) => { onChange(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          placeholder={placeholder} 
          className="w-full bg-surface-alt p-5 pr-12 rounded-[24px] font-bold text-main border border-subtle focus:border-[var(--color-primary)] outline-none transition-all" 
        />
        {onUseCurrentLocation && (
          <button 
            type="button" 
            onClick={onUseCurrentLocation}
            disabled={isLocating}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 active:scale-95 transition-all disabled:opacity-50"
          >
            {isLocating ? (
              <div className="w-5 h-5 border-2 border-[var(--color-primary)]/30 border-t-[var(--color-primary)] rounded-full animate-spin" />
            ) : (
              <Icons.Target className="w-5 h-5" />
            )}
          </button>
        )}
      </div>
      
      {showSuggestions && (searching || suggestions.length > 0) && (
        <div className="absolute z-50 top-[100%] left-0 right-0 bg-surface border border-subtle rounded-3xl mt-2 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
          {searching && <div className="p-4 text-center"><div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" /></div>}
          {suggestions.map((item, idx) => (
            <button 
              key={idx} 
              onClick={() => { 
                onChange(item.display_name, parseFloat(item.lat), parseFloat(item.lon)); 
                setShowSuggestions(false); 
              }} 
              className="w-full text-left p-4 hover:bg-[var(--color-primary)]/10 text-[11px] font-bold border-b border-subtle last:border-0 leading-tight"
            >
              {item.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const MapContainer = ({ lat, lng, secondaryLat, secondaryLng, showRoute = false, interaction = false }: { lat: number, lng: number, secondaryLat?: number, secondaryLng?: number, showRoute?: boolean, interaction?: boolean }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletInstance = useRef<any>(null);
  const marker1 = useRef<any>(null);
  const marker2 = useRef<any>(null);
  const polyline = useRef<any>(null);

  useEffect(() => {
    if (mapRef.current && !leafletInstance.current && typeof L !== 'undefined') {
      leafletInstance.current = L.map(mapRef.current, { 
        zoomControl: false, 
        attributionControl: false, 
        dragging: interaction, 
        touchZoom: interaction, 
        scrollWheelZoom: interaction, 
        doubleClickZoom: interaction, 
        boxZoom: interaction 
      }).setView([lat, lng], 13);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(leafletInstance.current);
      
      marker1.current = L.marker([lat, lng], { 
        icon: L.divIcon({ className: 'live-marker animate-pulse-primary', html: '<div style="width: 100%; height: 100%; border-radius: 50%; background: var(--color-primary); border: 3px solid white; box-shadow: 0 0 15px var(--color-primary);"></div>', iconSize: [20, 20] })
      }).addTo(leafletInstance.current);
    }
  }, []);

  useEffect(() => {
    if (leafletInstance.current) {
        marker1.current?.setLatLng([lat, lng]);
        if (secondaryLat && secondaryLng) {
            if (!marker2.current) {
               marker2.current = L.marker([secondaryLat, secondaryLng], { 
                 icon: L.divIcon({ className: 'live-marker', html: '<div style="width: 100%; height: 100%; border-radius: 50%; background: var(--color-accent); border: 3px solid white; box-shadow: 0 0 15px var(--color-accent);"></div>', iconSize: [20, 20] }) 
               }).addTo(leafletInstance.current);
            } else { marker2.current.setLatLng([secondaryLat, secondaryLng]); }
            
            if (showRoute) {
              if (polyline.current) polyline.current.remove();
              polyline.current = L.polyline([[lat, lng], [secondaryLat, secondaryLng]], { color: 'var(--color-primary)', weight: 5, dashArray: '10, 15', opacity: 0.8 }).addTo(leafletInstance.current);
              try { leafletInstance.current.fitBounds(polyline.current.getBounds(), { padding: [50, 50] }); } catch(e) {}
            }
        } else {
            leafletInstance.current.setView([lat, lng], 13);
        }
    }
  }, [lat, lng, secondaryLat, secondaryLng]);

  return <div ref={mapRef} className="h-full w-full rounded-[var(--radius-card)] overflow-hidden border border-subtle bg-surface-alt pointer-events-none" />;
};

export default function App() {
  const [view, setView] = useState<ViewState>('LOGIN');
  const [user, setUser] = useState<User | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [authMode, setAuthMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [loading, setLoading] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  // Authentication Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Offer Ride (Post) Fields
  const [postFrom, setPostFrom] = useState('');
  const [postFromCoords, setPostFromCoords] = useState<{lat: number, lon: number} | null>(null);
  const [postTo, setPostTo] = useState('');
  const [postToCoords, setPostToCoords] = useState<{lat: number, lon: number} | null>(null);
  const [postPrice, setPostPrice] = useState(150);
  const [postSeats, setPostSeats] = useState(3);
  const [postVehicle, setPostVehicle] = useState(VehicleType.CAR);
  const [postDescription, setPostDescription] = useState('');
  
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Background Location Tracking for Drivers
  useEffect(() => {
    if (user && user.driverVerificationStatus === 'VERIFIED') {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          locationService.updateUserLocation(user.id, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
        },
        null,
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [user]);

  const handleAuthUser = async (authUser: any) => {
    setLoading(true);
    const uid = authUser.uid || authUser.id;
    const { data: profile } = await userService.getUserProfile(uid);
    
    const effectiveProfile = profile || {
        name: authUser.displayName || 'Guest User',
        avatar: authUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`,
        role: 'customer',
        isDriver: false,
        rating: 5.0,
        tripsCount: 0,
        isOnboarded: false,
        isVerified: false,
        driverVerificationStatus: 'NONE',
        co2Saved: 0,
        moneySaved: 0,
        balance: 0,
        earnings: 0
    };

    const userData: User = { id: uid, ...effectiveProfile };
    setUser(userData);
    const adminStatus = await adminService.checkIsAdmin(uid);
    setIsAdmin(adminStatus);
    
    // Fetch user bookings to check for active rides
    const userBookings = await bookingService.getUserBookings(uid);
    // Find the most recent confirmed booking that isn't cancelled
    const active = userBookings.find((b: any) => b.status === 'CONFIRMED');
    if (active) setActiveBooking(active as Booking);
    
    // ONBOARDING FLOW ENFORCEMENT
    // 1. Profile Setup (Phone, Address)
    if (!userData.phone || !userData.address) {
       setView('PROFILE_SETUP');
    } 
    // 2. Aadhaar KYC (Mandatory for ALL users)
    else if (!userData.kycData) {
       setView('CUSTOMER_KYC');
    }
    // 3. Driver KYC (Mandatory if Role is Driver)
    else if (userData.isDriver && userData.driverVerificationStatus === 'NONE') {
       setView('DRIVER_KYC');
    } 
    // 4. Go Home (if currently in an onboarding view or login)
    else if (view === 'LOGIN' || view === 'PROFILE_SETUP' || view === 'CUSTOMER_KYC' || view === 'DRIVER_KYC') {
       setView('HOME');
    }

    setLoading(false);
    return userData;
  };

  useEffect(() => {
    let unsubscribeTrips: (() => void) | null = null;
    const unsubscribeAuth = authService.onAuthStateChange(async (authUser) => {
      if (authUser) {
        await handleAuthUser(authUser);
        if (!unsubscribeTrips) {
             unsubscribeTrips = tripService.listenToTrips((updatedTrips) => setTrips(updatedTrips));
        }
      } else {
        setUser(null);
        setView('LOGIN');
        setIsAdmin(false);
        if (unsubscribeTrips) { unsubscribeTrips(); unsubscribeTrips = null; }
        setTrips([]);
      }
      setAuthInitialized(true);
    });
    return () => { if (unsubscribeTrips) unsubscribeTrips(); unsubscribeAuth(); };
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (authMode === 'SIGNUP') {
        if (password !== confirmPassword) { setError("Passwords do not match"); setLoading(false); return; }
        const { data, error: signUpError } = await authService.signUp(email, password, name);
        if (signUpError) setError(signUpError.message);
        else if (data?.user && !data?.session) setVerificationSent(true);
        else if (data?.user) handleAuthUser(data.user);
    } else {
        const { data, error: signInError } = await authService.signIn(email, password);
        if (signInError) setError(signInError.message || "Login failed.");
        else if (data?.user) handleAuthUser(data.user);
    }
    setLoading(false);
  };

  const handleSuggestAi = async () => {
    if (!postFrom || !postTo) { alert("Please enter Origin and Destination first."); return; }
    setIsGeneratingAi(true);
    try {
      const [desc, price] = await Promise.all([
        generateTripDescription(postFrom, postTo, postVehicle),
        suggestTripPrice(postFrom, postTo, postVehicle)
      ]);
      setPostDescription(desc);
      setPostPrice(Math.round(price));
    } catch (e) {
      console.error("AI Generation failed", e);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) { alert("Geolocation not supported."); return; }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setPostFromCoords({ lat: latitude, lon: longitude });
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          if (data && data.display_name) {
             setPostFrom(data.display_name);
          }
        } catch (err) {
          console.error("Geocoding error:", err);
        } finally {
          setIsLocating(false);
        }
      },
      (err) => { setIsLocating(false); alert("Please enable GPS for accurate pickup."); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handlePublishRide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.driverVerificationStatus !== 'VERIFIED') return;
    setLoading(true);
    const tripData = { 
      ownerId: user.id, ownerName: user.name, ownerAvatar: user.avatar, ownerRating: user.rating, ownerPhone: user.phone || "+91 00000 00000", 
      from: postFrom, to: postTo, date: 'Today', time: 'ASAP', vehicleType: postVehicle, pricePerSeat: postPrice, availableSeats: postSeats, 
      status: TripStatus.OPEN, description: postDescription || "Cruising through Kerala. Join me!", requests: [] 
    };
    const { error: tripError } = await tripService.createTrip(tripData);
    if (tripError) alert("Failed to publish: " + tripError.message);
    else {
      setPostFrom(''); setPostTo(''); setPostDescription(''); setPostFromCoords(null); setPostToCoords(null);
      setView('SEARCH');
    }
    setLoading(false);
  };

  const handleOnPaymentSuccess = async (booking: Booking, method: string) => {
    if (!user) return;
    setLoading(true);
    const { data: savedBooking, error: bookError } = await bookingService.createBooking(booking, method);
    if (bookError) alert("Booking failed: " + bookError.message);
    else { setActiveBooking(savedBooking as Booking); setView('RECEIPT'); handleAuthUser(user); }
    setLoading(false);
  };

  if (!authInitialized) {
      return (
        <div className="h-[100dvh] flex items-center justify-center bg-app">
            <div className="flex flex-col items-center animate-pulse">
                <Icons.Logo className="w-16 h-16 text-[var(--color-primary)] mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted">Loading TripIn...</p>
            </div>
        </div>
      );
  }

  const renderView = () => {
    switch(view) {
      case 'LOGIN':
        if (verificationSent) {
          return (
             <div className="h-full flex flex-col items-center justify-center p-8 animate-in fade-in">
               <div className="bg-surface p-8 rounded-[40px] border border-subtle card-shadow w-full max-w-sm text-center space-y-6">
                 <div className="w-20 h-20 bg-[var(--color-primary)]/10 rounded-full mx-auto flex items-center justify-center text-[var(--color-primary)]">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                 </div>
                 <h2 className="text-2xl font-black italic uppercase text-main">Verify your Account</h2>
                 <p className="text-muted text-sm font-medium">Verification link sent to your email.</p>
                 <button onClick={() => { setVerificationSent(false); setAuthMode('LOGIN'); }} className="w-full bg-[var(--color-primary)] text-white py-5 rounded-[24px] font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all">Back to Login</button>
               </div>
            </div>
          );
        }
        return (
          <div className="h-full flex flex-col items-center justify-center p-8 animate-in fade-in">
            <div className="mb-6 transform hover:scale-105 transition-all duration-500"><Icons.Logo className="w-24 h-24 text-[var(--color-primary)]" /></div>
            <h1 className="text-4xl font-black italic uppercase text-[var(--color-primary)] mb-2 tracking-tighter">TripIn</h1>
            <p className="text-muted text-xs font-black uppercase tracking-[0.5em] mb-12 text-center leading-relaxed">Kerala Community</p>
            <form onSubmit={handleAuth} className="w-full space-y-4 max-w-sm">
              {authMode === 'SIGNUP' && (<input value={name} onChange={(e) => setName(e.target.value)} type="text" placeholder="Full Name" className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-main border border-subtle outline-none focus:border-[var(--color-primary)] transition-all" required />)}
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email Address" className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-main border border-subtle outline-none focus:border-[var(--color-primary)]" required />
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-main border border-subtle outline-none focus:border-[var(--color-primary)]" required />
              {authMode === 'SIGNUP' && (<input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" placeholder="Repeat Password" className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-main border border-subtle outline-none focus:border-[var(--color-primary)]" required />)}
              {error && (<div className="bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20"><p className="text-rose-500 text-[10px] font-black uppercase tracking-widest text-center">{error}</p></div>)}
              <button disabled={loading} className="w-full bg-[var(--color-primary)] text-white py-5 rounded-[24px] font-black text-xs uppercase tracking-widest shadow-xl shadow-[var(--color-primary)]/20 active:scale-95 transition-all">
                {loading ? 'Processing...' : (authMode === 'LOGIN' ? 'Login' : 'Create Account')}
              </button>
            </form>
            <button onClick={() => { setAuthMode(authMode === 'LOGIN' ? 'SIGNUP' : 'LOGIN'); setError(null); }} className="mt-8 text-muted text-[10px] font-black uppercase tracking-widest hover:text-[var(--color-primary)]">
                {authMode === 'LOGIN' ? "New here? Join TripIn" : "Already a member? Login"}
            </button>
          </div>
        );
      
      case 'PROFILE_SETUP':
        return user ? <ProfileSetup user={user} onSuccess={async () => { await handleAuthUser(user); }} /> : null;

      case 'CUSTOMER_KYC': 
        return user ? <CustomerKYC user={user} onBack={() => setView('PROFILE')} onSuccess={async () => { await handleAuthUser(user); }} /> : null;
      
      case 'DRIVER_KYC': 
        return user ? <DriverKYC user={user} onBack={() => setView('PROFILE')} onSuccess={async () => { await handleAuthUser(user); }} /> : null;

      case 'HOME':
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
        
        return (
          <div className="p-6 space-y-6 animate-in fade-in pb-32">
            {/* Header */}
            <div className="space-y-1">
              <p className="text-muted text-xs font-bold uppercase tracking-widest">{greeting},</p>
              <h1 className="text-3xl font-black italic text-main tracking-tighter">{user?.name?.split(' ')[0] || 'Friend'}</h1>
            </div>

            {/* Impact Stats (Moved to Top & Redesigned) */}
             <div className="bg-surface p-6 rounded-[32px] border border-subtle card-shadow relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-blue-500"></div>
                <div className="flex justify-between items-end mb-6">
                    <div>
                        <h3 className="text-[10px] font-black uppercase text-muted tracking-widest mb-1">Eco-Warrior Status</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-black italic text-main">Level {Math.floor((user?.tripsCount || 0) / 10) + 1}</span>
                            <Icons.Shield className="w-5 h-5 text-emerald-500" />
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-[9px] font-bold bg-surface-alt px-3 py-1 rounded-full border border-subtle text-main">
                            {user?.tripsCount || 0} Trips
                        </span>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-4 rounded-[24px] text-white relative overflow-hidden shadow-lg shadow-emerald-500/20 group hover:scale-[1.02] transition-transform">
                        <div className="absolute -right-3 -bottom-3 opacity-20"><Icons.Leaf className="w-20 h-20" /></div>
                        <p className="text-[24px] font-black tracking-tighter">{user?.co2Saved || 0}<span className="text-sm font-bold opacity-80">kg</span></p>
                        <p className="text-[9px] font-bold uppercase tracking-widest opacity-90">CO2 Saved</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-4 rounded-[24px] text-white relative overflow-hidden shadow-lg shadow-blue-500/20 group hover:scale-[1.02] transition-transform">
                        <div className="absolute -right-3 -bottom-3 opacity-20"><Icons.Wallet className="w-20 h-20" /></div>
                        <p className="text-[24px] font-black tracking-tighter">₹{user?.moneySaved || 0}</p>
                        <p className="text-[9px] font-bold uppercase tracking-widest opacity-90">Fuel Saved</p>
                    </div>
                </div>
            </div>

            {/* Main Action Grid */}
            <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setView('SEARCH')} className="bg-surface p-6 rounded-[32px] border border-subtle card-shadow relative overflow-hidden group active:scale-95 transition-all text-left h-40 flex flex-col justify-between">
                    <div className="absolute right-[-20px] top-[-20px] w-24 h-24 bg-[var(--color-primary)]/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
                    <div className="w-10 h-10 bg-[var(--color-primary)]/10 rounded-full flex items-center justify-center text-[var(--color-primary)] z-10">
                        <Icons.Search />
                    </div>
                    <div>
                        <p className="text-lg font-black text-main">Find<br/>Pool</p>
                        <p className="text-[9px] text-muted font-bold mt-1">Commute & Save</p>
                    </div>
                </button>

                <button onClick={() => setView('POST')} className="bg-[#EA580C] p-6 rounded-[32px] shadow-xl shadow-orange-500/20 relative overflow-hidden group active:scale-95 transition-all text-left h-40 flex flex-col justify-between">
                    <div className="absolute right-[-20px] top-[-20px] w-24 h-24 bg-white/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white z-10">
                        <Icons.Plus />
                    </div>
                    <div>
                        <p className="text-lg font-black text-white">Offer<br/>Ride</p>
                        <p className="text-[9px] text-white/80 font-bold mt-1">Share & Earn</p>
                    </div>
                </button>
            </div>

            {/* Active Ride Card (Moved Bottom) */}
            {activeBooking && activeBooking.status === 'CONFIRMED' && (
                <div onClick={() => setView('RECEIPT')} className="bg-white border-2 border-blue-100 p-6 rounded-[32px] shadow-xl shadow-blue-100/50 relative overflow-hidden cursor-pointer active:scale-95 transition-all">
                    <div className="flex justify-between items-start mb-4">
                         <div>
                            <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest animate-pulse inline-block mb-2">Live Ride</span>
                            <p className="text-[10px] font-bold text-muted uppercase">Currently active</p>
                         </div>
                         <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                             <Icons.Car className="w-5 h-5" />
                         </div>
                    </div>
                    <div className="flex justify-between items-end">
                       <div>
                          <p className="text-xl font-black text-main leading-none">{activeBooking.to.split(',')[0]}</p>
                          <p className="text-[10px] font-bold text-muted mt-1">Tap for details</p>
                       </div>
                       <div className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase">
                          Track >
                       </div>
                    </div>
                </div>
            )}

            {/* Popular Routes */}
            <div>
                <h3 className="text-[10px] font-black uppercase text-muted tracking-widest mb-4 ml-2">Popular in Kerala</h3>
                <div className="flex gap-3 overflow-x-auto pb-4 custom-scroll -mx-6 px-6">
                    {['Technopark', 'Infopark', 'Lulu Mall', 'Varkala', 'Fort Kochi', 'Munnar', 'Kozhikode Beach', 'Alappuzha'].map(place => (
                        <div key={place} className="flex-shrink-0 bg-surface border border-subtle px-5 py-3 rounded-2xl whitespace-nowrap active:scale-95 transition-all">
                            <p className="text-xs font-bold text-main">{place}</p>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        );

      case 'SEARCH':
        return (
          <div className="p-8 space-y-8 animate-in slide-in-from-right-8 pb-40">
            <h2 className="text-3xl font-black italic uppercase text-main tracking-tighter">Active Pools</h2>
            <div className="space-y-4">
              {trips.length > 0 ? (
                trips.map(trip => (
                  <div key={trip.id} onClick={() => { setSelectedTrip(trip); setView('TRIP_DETAIL'); }} className="bg-surface p-6 rounded-[32px] border border-subtle card-shadow flex justify-between items-center active:scale-[0.98] transition-all group">
                    <div className="flex items-center gap-4">
                      <img src={trip.ownerAvatar} className="w-14 h-14 rounded-2xl border-2 border-subtle group-hover:border-[var(--color-primary)]" />
                      <div className="space-y-1">
                        <p className="text-xs font-black text-main uppercase">{trip.ownerName} <span className="text-[8px] text-[var(--color-primary)]">★ {trip.ownerRating}</span></p>
                        <p className="text-[9px] font-bold text-muted uppercase">{trip.from.split(',')[0]} → {trip.to.split(',')[0]}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-[var(--color-primary)]">₹{trip.pricePerSeat}</p>
                      <p className="text-[8px] font-bold text-muted uppercase">{trip.availableSeats} Seats</p>
                    </div>
                  </div>
                ))
              ) : (<div className="py-20 text-center text-muted font-black uppercase text-[10px] border border-dashed border-subtle rounded-[32px]">No active pools found</div>)}
            </div>
          </div>
        );

      case 'TRIP_DETAIL':
        return selectedTrip && (
          <div className="p-8 space-y-8 animate-in slide-in-from-bottom-8">
            <button onClick={() => setView('SEARCH')} className="text-muted text-[10px] font-black uppercase flex items-center gap-2 hover:text-main">← Back to Search</button>
            <div className="bg-surface p-8 rounded-[48px] border border-subtle card-shadow space-y-8">
              <div className="h-48 rounded-[var(--radius-card)] overflow-hidden relative z-0">
                <MapContainer lat={8.5471} lng={76.8831} />
              </div>
              <div className="flex items-center gap-5">
                <img src={selectedTrip.ownerAvatar} className="w-20 h-20 rounded-[28px] border-4 border-[var(--color-primary)]/20" />
                <div><h3 className="text-xl font-black uppercase text-main tracking-tighter">{selectedTrip.ownerName}</h3><p className="text-[10px] font-black text-[var(--color-primary)] uppercase">Verified Citizen</p></div>
              </div>
              <button onClick={() => setView('PAYMENT')} className="w-full bg-[var(--color-primary)] text-white py-6 rounded-[30px] font-black text-xs uppercase tracking-widest shadow-2xl transition-all active:scale-95">Book Seat (₹{selectedTrip.pricePerSeat})</button>
            </div>
          </div>
        );

      case 'PAYMENT': return selectedTrip && user ? <PaymentScreen trip={selectedTrip} user={user} onBack={() => setView('TRIP_DETAIL')} onPaymentSuccess={handleOnPaymentSuccess} /> : null;
      case 'RECEIPT': return activeBooking ? <ReceiptScreen booking={activeBooking} onHome={() => setView('HOME')} onChat={() => setView('CHAT')} onTrack={() => setView('LIVE_TRACKING')} onCancelSuccess={async () => { await handleAuthUser(user); setView('HOME'); }} /> : null;
      case 'CHAT': return activeBooking && user ? <ChatScreen booking={activeBooking} currentUser={user} onBack={() => setView('RECEIPT')} /> : null;

      case 'POST':
        if (!user) return null;
        if (user.driverVerificationStatus !== 'VERIFIED') {
             return (
              <div className="h-full flex flex-col items-center justify-center p-8 animate-in zoom-in-95">
                <div className="bg-surface p-8 rounded-[48px] border border-subtle card-shadow text-center space-y-6">
                    <div className="w-20 h-20 bg-amber-50 rounded-full mx-auto flex items-center justify-center text-amber-600 animate-pulse"><Icons.Shield className="w-10 h-10" /></div>
                    <h2 className="text-2xl font-black italic uppercase text-main">Pilot Verification</h2>
                    <p className="text-muted text-xs font-medium">To ensure safety, you must verify your driving license and vehicle before posting.</p>
                    <button onClick={() => setView('DRIVER_KYC')} className="w-full bg-[#EA580C] text-white py-5 rounded-2xl font-black text-[10px] uppercase shadow-xl active:scale-95 transition-all">Verify Now</button>
                </div>
              </div>
            );
        }
        return (
          <div className="p-8 space-y-8 animate-in slide-in-from-bottom-8 pb-40">
            <h2 className="text-3xl font-black italic uppercase text-main tracking-tighter">Offer Ride</h2>
            
            {/* Live Map Preview for Route Confirmation */}
            <div className="h-44 rounded-[40px] overflow-hidden border border-subtle relative z-0">
               <MapContainer 
                 lat={postFromCoords?.lat || 10.8505} 
                 lng={postFromCoords?.lon || 76.2711} 
                 secondaryLat={postToCoords?.lat} 
                 secondaryLng={postToCoords?.lon} 
                 showRoute={!!(postFromCoords && postToCoords)}
               />
               {!postFromCoords && <div className="absolute inset-0 bg-main/10 backdrop-blur-[2px] flex items-center justify-center"><p className="text-[9px] font-black uppercase text-main bg-white/80 px-4 py-2 rounded-full border border-subtle">Set Origin to Preview</p></div>}
            </div>

            <div className="bg-surface p-8 rounded-[48px] border border-subtle card-shadow space-y-6">
              <form onSubmit={handlePublishRide} className="space-y-8">
                <div className="space-y-6">
                  <LocationInput 
                    label="Origin" 
                    placeholder="Search pickup..." 
                    value={postFrom} 
                    onChange={(v, lat, lon) => { setPostFrom(v); if(lat) setPostFromCoords({lat, lon: lon!}); }}
                    onUseCurrentLocation={handleGetCurrentLocation}
                    isLocating={isLocating}
                  />
                  <LocationInput 
                    label="Destination" 
                    placeholder="Search dropoff..." 
                    value={postTo} 
                    onChange={(v, lat, lon) => { setPostTo(v); if(lat) setPostToCoords({lat, lon: lon!}); }} 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase text-muted ml-4">Price / Seat</label>
                     <input type="number" value={postPrice} onChange={e => setPostPrice(parseInt(e.target.value))} className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-main border border-subtle" />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase text-muted ml-4">Seats</label>
                     <input type="number" value={postSeats} onChange={e => setPostSeats(parseInt(e.target.value))} max={6} min={1} className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-main border border-subtle" />
                   </div>
                </div>
                <button type="button" onClick={handleSuggestAi} disabled={isGeneratingAi || !postFrom || !postTo} className="w-full bg-surface-alt text-[var(--color-primary)] border border-subtle py-4 rounded-[24px] font-black text-[10px] uppercase flex items-center justify-center gap-3">
                  {isGeneratingAi ? <div className="w-4 h-4 border-2 border-[var(--color-primary)]/30 border-t-[var(--color-primary)] rounded-full animate-spin" /> : <>✨ Optimize with AI</>}
                </button>
                <button disabled={loading} className="w-full bg-[var(--color-primary)] text-white py-6 rounded-[30px] font-black text-xs uppercase tracking-widest shadow-2xl active:scale-95 transition-all">Publish Ride</button>
              </form>
            </div>
          </div>
        );

      case 'PROFILE': return (
          <div className="p-8 space-y-8 animate-in fade-in pb-40">
            <div className="text-center space-y-6">
              <img src={user?.avatar} className="w-32 h-32 mx-auto rounded-[48px] border-4 border-[var(--color-primary)] shadow-2xl" />
              <h2 className="text-3xl font-black italic uppercase text-main tracking-tighter">{user?.name}</h2>
              {/* Verification Badge */}
              {user?.isVerified && (
                 <div className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">
                    <Icons.Shield className="w-3 h-3" /> Verified Citizen
                 </div>
              )}
              
              <div className="bg-surface p-6 rounded-[32px] border border-subtle card-shadow text-left">
                <p className="text-[10px] font-black text-muted uppercase tracking-widest">Digital Wallet</p>
                <div className="flex justify-between items-center mt-2"><p className="text-2xl font-black italic">₹{user?.balance || 0}</p><button onClick={() => setView('TOP_UP')} className="text-[10px] font-black text-[var(--color-primary)] uppercase bg-[var(--color-primary)]/10 px-4 py-2 rounded-xl">Top Up +</button></div>
              </div>
            </div>
            
            <div className="space-y-3 pt-4">
              {/* Earnings for Verified Drivers */}
              {user?.driverVerificationStatus === 'VERIFIED' && (
                <button onClick={() => setView('EARNINGS')} className="w-full bg-emerald-50 text-emerald-700 py-5 rounded-[24px] font-black text-[10px] uppercase border border-emerald-100 flex items-center justify-center gap-3 shadow-sm">
                  <Icons.Car className="w-3 h-3" /> My Earnings
                </button>
              )}
              
              {/* Verify Identity (Aadhaar) if not verified */}
              {!user?.isVerified && (
                <button onClick={() => setView('CUSTOMER_KYC')} className="w-full bg-amber-50 text-amber-600 py-5 rounded-[24px] font-black text-[10px] uppercase border border-amber-100 flex items-center justify-center gap-3 shadow-sm">
                   <Icons.Shield className="w-3 h-3" /> Verify Identity
                </button>
              )}

              {/* Complete Driver KYC if signed up as driver but not verified */}
              {user?.isDriver && user.driverVerificationStatus !== 'VERIFIED' && (
                 <button onClick={() => setView('DRIVER_KYC')} className="w-full bg-[#EA580C]/10 text-[#EA580C] py-5 rounded-[24px] font-black text-[10px] uppercase border border-[#EA580C]/20 flex items-center justify-center gap-3 shadow-sm">
                   <Icons.Car className="w-3 h-3" /> Complete Driver KYC
                </button>
              )}

              <button onClick={() => setView('PROFILE_SETUP')} className="w-full bg-surface p-5 rounded-[24px] font-black text-[10px] uppercase border border-subtle">Edit Profile</button>
              <button onClick={() => authService.signOut()} className="w-full bg-rose-500/10 text-rose-500 py-5 rounded-[24px] font-black text-[10px] uppercase border border-rose-500/20">Sign Out</button>
            </div>
          </div>
        );
      
      case 'CUSTOMER_KYC': return user ? <CustomerKYC user={user} onBack={() => setView('PROFILE')} onSuccess={async () => { await handleAuthUser(user); }} /> : null;
      case 'DRIVER_KYC': return user ? <DriverKYC user={user} onBack={() => setView('PROFILE')} onSuccess={async () => { await handleAuthUser(user); }} /> : null;
      case 'TOP_UP': return user ? <TopUpScreen user={user} onBack={() => setView('PROFILE')} onSuccess={async () => { await handleAuthUser(user); setView('PROFILE'); }} /> : null;
      case 'EARNINGS': return user ? <EarningsScreen user={user} onBack={() => setView('PROFILE')} onSuccess={async () => { await handleAuthUser(user); }} /> : null;
      case 'LIVE_TRACKING': return user && activeBooking ? <LiveTrackingScreen user={user} booking={activeBooking} onBack={() => setView('RECEIPT')} /> : null;
      default: return null;
    }
  };

  return (
    <div className="h-[100dvh] w-full bg-app text-main mx-auto flex flex-col shadow-2xl relative overflow-hidden transition-colors duration-300">
      {view !== 'LOGIN' && view !== 'LIVE_TRACKING' && view !== 'CHAT' && view !== 'PROFILE_SETUP' && (
        <header className="px-6 py-4 flex justify-between items-center border-b border-subtle sticky top-0 bg-surface/90 backdrop-blur-xl z-50">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('HOME')}><Icons.Logo className="w-8 h-8 text-[var(--color-primary)]" /><span className="font-black text-xl italic uppercase tracking-tighter text-[var(--color-primary)]">TripIn</span></div>
          <button onClick={() => setView('PROFILE')} className="w-10 h-10 rounded-2xl overflow-hidden border-2 border-[var(--color-primary)] active:scale-95 transition-all shadow-md"><img src={user?.avatar} className="w-full h-full object-cover" /></button>
        </header>
      )}
      <main className="flex-1 overflow-y-auto custom-scroll w-full">{renderView()}</main>
      {view !== 'LOGIN' && view !== 'CHAT' && view !== 'TOP_UP' && view !== 'LIVE_TRACKING' && view !== 'PROFILE_SETUP' && (
        <nav className="fixed bottom-0 left-0 w-full z-50 pb-[var(--safe-bottom)] bg-white/95 backdrop-blur-md border-t border-subtle">
           <div className="flex justify-around items-center px-4 py-3">
            <button onClick={() => setView('HOME')} className={`p-3 rounded-2xl transition-all ${view === 'HOME' ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10' : 'text-muted'}`}><Icons.Home /></button>
            <button onClick={() => setView('SEARCH')} className={`p-3 rounded-2xl transition-all ${view === 'SEARCH' ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10' : 'text-muted'}`}><Icons.Search /></button>
            <button onClick={() => setView('POST')} className={`p-3 rounded-2xl transition-all ${view === 'POST' ? 'text-[#EA580C] bg-[#EA580C]/10' : 'text-muted'}`}><Icons.Plus /></button>
            <button onClick={() => setView('PROFILE')} className={`p-3 rounded-2xl transition-all ${view === 'PROFILE' ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10' : 'text-muted'}`}><Icons.User /></button>
          </div>
        </nav>
      )}
    </div>
  );
}
