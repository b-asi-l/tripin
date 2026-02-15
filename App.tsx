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

declare const L: any;

const LocationInput = ({ label, placeholder, value, onChange }: { label: string, placeholder: string, value: string, onChange: (v: string) => void }) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const suggestions = KERALA_LOCATIONS.filter(loc => 
    loc.toLowerCase().includes(value.toLowerCase()) && value.length > 1
  ).slice(0, 5);

  return (
    <div className="space-y-2 relative" ref={containerRef}>
      <label className="text-[10px] font-black uppercase text-muted ml-4 tracking-widest">{label}</label>
      <input 
        value={value}
        onChange={(e) => { onChange(e.target.value); setShowSuggestions(true); }}
        onFocus={() => setShowSuggestions(true)}
        placeholder={placeholder} 
        className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-main border border-subtle focus:border-[var(--color-primary)] outline-none transition-all" 
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 top-[100%] left-0 right-0 bg-surface border border-subtle rounded-2xl mt-2 shadow-2xl overflow-hidden">
          {suggestions.map(loc => (
            <button key={loc} onClick={() => { onChange(loc); setShowSuggestions(false); }} className="w-full text-left p-4 hover:bg-[var(--color-primary)]/10 text-xs font-bold border-b border-subtle last:border-0">{loc}</button>
          ))}
        </div>
      )}
    </div>
  );
};

const MapContainer = ({ lat, lng, secondaryLat, secondaryLng, showRoute = false }: { lat: number, lng: number, secondaryLat?: number, secondaryLng?: number, showRoute?: boolean }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletInstance = useRef<any>(null);
  const marker1 = useRef<any>(null);
  const marker2 = useRef<any>(null);
  const polyline = useRef<any>(null);

  useEffect(() => {
    // @ts-ignore
    if (mapRef.current && !leafletInstance.current && typeof L !== 'undefined') {
      // @ts-ignore
      leafletInstance.current = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView([lat, lng], 13);
      // @ts-ignore
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(leafletInstance.current);
      // @ts-ignore
      marker1.current = L.marker([lat, lng], { 
        icon: L.divIcon({ className: 'live-marker animate-pulse-primary', html: '<div style="width: 100%; height: 100%; border-radius: 50%; background: var(--color-primary); border: 3px solid white; box-shadow: 0 0 15px var(--color-primary);"></div>', iconSize: [24, 24] })
      }).addTo(leafletInstance.current);
    }
  }, []);

  useEffect(() => {
    if (leafletInstance.current) {
        marker1.current?.setLatLng([lat, lng]);
        if (secondaryLat && secondaryLng) {
            if (!marker2.current) {
               // @ts-ignore
               marker2.current = L.marker([secondaryLat, secondaryLng], { icon: L.divIcon({ className: 'live-marker', html: '<div style="width: 100%; height: 100%; border-radius: 50%; background: var(--color-accent); border: 3px solid white; box-shadow: 0 0 15px var(--color-accent);"></div>', iconSize: [24, 24] }) }).addTo(leafletInstance.current);
            } else { marker2.current.setLatLng([secondaryLat, secondaryLng]); }
            if (showRoute) {
              if (polyline.current) polyline.current.remove();
              // @ts-ignore
              polyline.current = L.polyline([[lat, lng], [secondaryLat, secondaryLng]], { color: 'var(--color-primary)', weight: 5, dashArray: '10, 15', opacity: 0.8 }).addTo(leafletInstance.current);
              try { leafletInstance.current.fitBounds(polyline.current.getBounds(), { padding: [50, 50] }); } catch(e) {}
            }
        }
    }
  }, [lat, lng, secondaryLat, secondaryLng]);

  return <div ref={mapRef} className="h-full w-full rounded-[var(--radius-card)] overflow-hidden border border-subtle bg-surface-alt" />;
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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [postFrom, setPostFrom] = useState('');
  const [postTo, setPostTo] = useState('');
  const [postPrice, setPostPrice] = useState(150);
  const [postSeats, setPostSeats] = useState(3);
  const [postVehicle, setPostVehicle] = useState(VehicleType.CAR);
  const [postDescription, setPostDescription] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

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
    // Attempt to fetch profile from Firestore
    const { data: profile } = await userService.getUserProfile(uid);
    
    // Fallback: If profile fetch failed (e.g. guest mode write failed due to permissions, or network),
    // construct a temporary user object from authUser data so the app works.
    const effectiveProfile = profile || {
        name: authUser.displayName || 'Guest User',
        avatar: authUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`,
        role: 'customer',
        isDriver: false,
        rating: 5.0,
        tripsCount: 0,
        isOnboarded: false, // Default to false if data missing
        isVerified: false,
        driverVerificationStatus: 'NONE',
        co2Saved: 0,
        moneySaved: 0,
        balance: 0
    };

    const userData: User = {
        id: uid,
        ...effectiveProfile
    };

    setUser(userData);
    const adminStatus = await adminService.checkIsAdmin(uid);
    setIsAdmin(adminStatus);
    
    // Check if profile details are missing
    if (!userData.phone || !userData.address) {
       setView('PROFILE_SETUP');
    } else if (view === 'LOGIN' || view === 'PROFILE_SETUP') {
       // If user is a pending driver, go to KYC, otherwise home
       // (Only if not already on specific views)
       setView('HOME');
    }

    setLoading(false);
    return userData; // Return updated user object
  };

  useEffect(() => {
    let unsubscribeTrips: (() => void) | null = null;

    const unsubscribeAuth = authService.onAuthStateChange(async (authUser) => {
      if (authUser) {
        await handleAuthUser(authUser);
        if (!unsubscribeTrips) {
             unsubscribeTrips = tripService.listenToTrips((updatedTrips) => {
              setTrips(updatedTrips);
            });
        }
      } else {
        setUser(null);
        setView('LOGIN');
        setIsAdmin(false);
        if (unsubscribeTrips) {
            unsubscribeTrips();
            unsubscribeTrips = null;
        }
        setTrips([]);
      }
      setAuthInitialized(true);
    });

    return () => {
      if (unsubscribeTrips) unsubscribeTrips();
      unsubscribeAuth();
    };
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (authMode === 'SIGNUP') {
        if (password !== confirmPassword) { setError("Passwords do not match"); setLoading(false); return; }
        const { data, error: signUpError } = await authService.signUp(email, password, name);
        if (signUpError) {
          setError(signUpError.message);
        } else if (data?.user && !data?.session) {
          setVerificationSent(true);
          setLoading(false);
          return;
        } else if (data?.user) {
          handleAuthUser(data.user);
        }
    } else {
        const { data, error: signInError } = await authService.signIn(email, password);
        if (signInError) {
          setError(signInError.message || "Login failed. Check credentials.");
        } else if (data?.user) {
          handleAuthUser(data.user);
        }
    }
    setLoading(false);
  };

  const handleSuggestAi = async () => {
    if (!postFrom || !postTo) {
      alert("Please enter Origin and Destination first.");
      return;
    }
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

  const handlePublishRide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (user.driverVerificationStatus !== 'VERIFIED') {
      return;
    }

    setLoading(true);
    
    const tripData = { 
      ownerId: user.id, 
      ownerName: user.name, 
      ownerAvatar: user.avatar, 
      ownerRating: user.rating, 
      ownerPhone: user.phone || "+91 00000 00000", 
      from: postFrom, 
      to: postTo, 
      date: 'Today', 
      time: 'ASAP', 
      vehicleType: postVehicle, 
      pricePerSeat: postPrice, 
      availableSeats: postSeats, 
      status: TripStatus.OPEN, 
      description: postDescription || "Cruising through Kerala. Join me!",
      requests: [] 
    };

    const { error: tripError, data: newTrip } = await tripService.createTrip(tripData);
    
    if (tripError) {
      alert("Failed to publish trip. Ensure you are a verified driver. Error: " + tripError.message);
    } else {
      setPostFrom('');
      setPostTo('');
      setPostDescription('');
      const { data: latestTrips } = await tripService.getAllTrips();
      if (latestTrips) setTrips(latestTrips);
      setView('SEARCH');
    }
    setLoading(false);
  };

  const handleOnPaymentSuccess = async (booking: Booking, method: string) => {
    if (!user) return;
    setLoading(true);
    const { data: savedBooking, error: bookError } = await bookingService.createBooking(booking, method);
    if (bookError) {
        alert("Booking failed to save: " + bookError.message);
    } else {
        setActiveBooking(savedBooking as Booking);
        setView('RECEIPT');
        handleAuthUser(user);
    }
    setLoading(false);
  };

  const handlePostRideNavigation = () => {
    setView('POST');
  };

  if (!authInitialized) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-app">
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
             <div className="min-h-screen flex flex-col items-center justify-center p-8 animate-in fade-in">
               <div className="bg-surface p-8 rounded-[40px] border border-subtle card-shadow w-full max-w-sm text-center space-y-6">
                 <div className="w-20 h-20 bg-[var(--color-primary)]/10 rounded-full mx-auto flex items-center justify-center text-[var(--color-primary)]">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                 </div>
                 <h2 className="text-2xl font-black italic uppercase text-main">Verify your Account</h2>
                 <p className="text-muted text-sm font-medium">We have sent a verification link to your email. Please click it to sign in.</p>
                 <button 
                    onClick={() => { setVerificationSent(false); setAuthMode('LOGIN'); }}
                    className="w-full bg-[var(--color-primary)] text-white py-5 rounded-[24px] font-black text-xs uppercase tracking-widest shadow-xl shadow-[var(--color-primary)]/20 active:scale-95 transition-all"
                 >
                    Back to Login
                 </button>
               </div>
            </div>
          );
        }

        return (
          <div className="min-h-screen flex flex-col items-center justify-center p-8 animate-in fade-in">
            <div className="mb-6 transform hover:scale-105 transition-all duration-500">
               <Icons.Logo className="w-24 h-24 text-[var(--color-primary)]" />
            </div>
            <h1 className="text-4xl font-black italic uppercase text-[var(--color-primary)] mb-2 tracking-tighter">TripIn</h1>
            <p className="text-muted text-[10px] font-black uppercase tracking-[0.5em] mb-12 text-center leading-relaxed">Kerala Community Mobility</p>
            
            <form onSubmit={handleAuth} className="w-full space-y-4 max-w-sm">
              {authMode === 'SIGNUP' && (
                <input value={name} onChange={(e) => setName(e.target.value)} type="text" placeholder="Full Name" className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-main border border-subtle outline-none focus:border-[var(--color-primary)] transition-all" required />
              )}
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email Address" className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-main border border-subtle outline-none focus:border-[var(--color-primary)]" required />
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-main border border-subtle outline-none focus:border-[var(--color-primary)]" required />
              {authMode === 'SIGNUP' && (
                  <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" placeholder="Repeat Password" className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-main border border-subtle outline-none focus:border-[var(--color-primary)]" required />
              )}
              {error && (
                <div className="bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20">
                  <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest text-center">{error}</p>
                </div>
              )}
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
        return user ? <ProfileSetup user={user} onSuccess={async (role) => { 
           const updatedUser = await handleAuthUser(user); 
           if (role === 'driver') setView('DRIVER_KYC');
           else setView('HOME'); 
        }} /> : null;

      case 'HOME':
        return (
          <div className="p-8 space-y-8 animate-in fade-in">
            <div className="bg-gradient-to-br from-[#16A34A] to-[#15803D] p-8 rounded-[40px] border border-white/10 card-shadow relative overflow-hidden text-white">
              <h3 className="text-white/80 text-[10px] font-black uppercase tracking-[0.3em] mb-6">Global Impact Score</h3>
              <div className="grid grid-cols-2 gap-8 relative z-10">
                <div><p className="text-4xl font-black italic">{user?.co2Saved || 0}kg</p><p className="text-[9px] font-bold text-white/70 uppercase">CO2 Avoided</p></div>
                <div><p className="text-4xl font-black italic">₹{user?.moneySaved || 0}</p><p className="text-[9px] font-bold text-white/70 uppercase">Fuel Saved</p></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setView('SEARCH')} className="bg-surface p-8 rounded-[40px] border border-subtle card-shadow flex flex-col items-center gap-4 active:scale-95 transition-all group">
                <div className="bg-[var(--color-primary)]/10 p-4 rounded-2xl text-[var(--color-primary)] group-hover:bg-[var(--color-primary)] group-hover:text-white transition-all"><Icons.Search /></div>
                <span className="font-black text-[10px] uppercase text-main">Find Ride</span>
              </button>
              <button onClick={handlePostRideNavigation} className="bg-surface p-8 rounded-[40px] border border-subtle card-shadow flex flex-col items-center gap-4 active:scale-95 transition-all group">
                <div className="bg-[#EA580C]/10 p-4 rounded-2xl text-[#EA580C] group-hover:bg-[#EA580C] group-hover:text-white transition-all"><Icons.Plus /></div>
                <span className="font-black text-[10px] uppercase text-main">Post Ride</span>
              </button>
            </div>
          </div>
        );

      case 'SEARCH':
        return (
          <div className="p-8 space-y-8 animate-in slide-in-from-right-8 pb-32">
            <h2 className="text-3xl font-black italic uppercase text-main tracking-tighter">Active Pools</h2>
            <div className="space-y-4">
              {trips.length > 0 ? (
                trips.map(trip => (
                  <div key={trip.id} onClick={() => { setSelectedTrip(trip); setView('TRIP_DETAIL'); }} className="bg-surface p-6 rounded-[32px] border border-subtle card-shadow flex justify-between items-center active:scale-[0.98] transition-all group">
                    <div className="flex items-center gap-4">
                      <img src={trip.ownerAvatar} className="w-14 h-14 rounded-2xl border-2 border-subtle group-hover:border-[var(--color-primary)] transition-all" />
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
              ) : (
                <div className="py-20 text-center text-muted font-black uppercase text-[10px] tracking-widest border border-dashed border-subtle rounded-[32px] flex flex-col items-center gap-4">
                  <p>No active pools found</p>
                  <button onClick={async () => {
                     setLoading(true);
                     const { data } = await tripService.getAllTrips();
                     if (data) setTrips(data);
                     setLoading(false);
                  }} className="text-[8px] underline opacity-50">Force Refresh List</button>
                </div>
              )}
            </div>
          </div>
        );

      case 'TRIP_DETAIL':
        return selectedTrip && (
          <div className="p-8 space-y-8 animate-in slide-in-from-bottom-8">
            <button onClick={() => setView('SEARCH')} className="text-muted text-[10px] font-black uppercase flex items-center gap-2 hover:text-main">← Back to Search</button>
            <div className="bg-surface p-8 rounded-[48px] border border-subtle card-shadow space-y-8">
              <div className="h-48 rounded-[var(--radius-card)] overflow-hidden">
                <MapContainer lat={8.5471} lng={76.8831} />
              </div>
              <div className="flex items-center gap-5">
                <img src={selectedTrip.ownerAvatar} className="w-20 h-20 rounded-[28px] border-4 border-[var(--color-primary)]/20" />
                <div><h3 className="text-xl font-black uppercase text-main tracking-tighter">{selectedTrip.ownerName}</h3><p className="text-[10px] font-black text-[var(--color-primary)] uppercase">Verified Citizen</p></div>
              </div>
              <div className="space-y-2">
                 <p className="text-[10px] font-black uppercase text-muted tracking-widest">About the Trip</p>
                 <p className="text-sm font-bold text-main italic opacity-80">{selectedTrip.description}</p>
              </div>
              <button onClick={() => setView('PAYMENT')} className="w-full bg-[var(--color-primary)] text-white py-6 rounded-[30px] font-black text-xs uppercase tracking-widest shadow-2xl transition-all active:scale-95">Book Seat (₹{selectedTrip.pricePerSeat})</button>
            </div>
          </div>
        );

      case 'PAYMENT':
        return selectedTrip && user ? (
          <PaymentScreen 
            trip={selectedTrip} 
            user={user} 
            onBack={() => setView('TRIP_DETAIL')} 
            onPaymentSuccess={(b, method) => handleOnPaymentSuccess(b, method)} 
          />
        ) : null;

      case 'RECEIPT':
        return activeBooking && <ReceiptScreen booking={activeBooking} onHome={() => setView('HOME')} onChat={() => setView('CHAT')} onTrack={() => setView('LIVE_TRACKING')} />;

      case 'CHAT':
        return activeBooking ? (
          <ChatScreen 
            otherName={activeBooking.ownerName} 
            otherAvatar={activeBooking.ownerAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeBooking.ownerName}`}
            onBack={() => setView('RECEIPT')} 
          />
        ) : selectedTrip ? (
          <ChatScreen 
            otherName={selectedTrip.ownerName} 
            otherAvatar={selectedTrip.ownerAvatar}
            onBack={() => setView('TRIP_DETAIL')} 
          />
        ) : null;

      case 'POST':
        if (!user) return null;
        
        // 1. Pending Verification
        if (user.driverVerificationStatus === 'PENDING') {
            return (
              <div className="p-8 h-full flex flex-col items-center justify-center animate-in zoom-in-95">
                <div className="bg-surface p-8 rounded-[48px] border border-subtle card-shadow text-center space-y-6">
                    <div className="w-20 h-20 bg-amber-100 rounded-full mx-auto flex items-center justify-center text-amber-600 animate-pulse">
                        <Icons.Shield className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-black italic uppercase text-main tracking-tighter">Request Under Processing</h2>
                    <p className="text-muted text-xs font-medium">Your request is currently being processed. Our admin team is reviewing your documents.</p>
                    <button onClick={() => setView('HOME')} className="w-full bg-surface-alt text-main py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-subtle">Back to Home</button>
                </div>
              </div>
            );
        }

        // 2. Not a driver (Customer attempting to post)
        if (user.driverVerificationStatus === 'NONE' || user.driverVerificationStatus === 'REJECTED') {
             return (
              <div className="p-8 h-full flex flex-col items-center justify-center animate-in zoom-in-95">
                <div className="bg-surface p-8 rounded-[48px] border border-subtle card-shadow text-center space-y-6">
                    <div className="w-20 h-20 bg-[#EA580C]/10 rounded-full mx-auto flex items-center justify-center text-[#EA580C]">
                        <Icons.Car className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-black italic uppercase text-main tracking-tighter">Become a Pilot</h2>
                    <p className="text-muted text-xs font-medium">To ensure community safety, you must verify your driving license and vehicle before posting rides.</p>
                    <button onClick={() => setView('DRIVER_KYC')} className="w-full bg-[#EA580C] text-white py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-orange-500/20 active:scale-95 transition-all">Verify Now</button>
                    <button onClick={() => setView('HOME')} className="w-full bg-surface-alt text-main py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-subtle">Maybe Later</button>
                </div>
              </div>
            );
        }

        return (
          <div className="p-8 space-y-8 animate-in slide-in-from-bottom-8 pb-32">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-black italic uppercase text-main tracking-tighter">Offer Ride</h2>
              <div className="flex items-center gap-2 bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Verified Pilot</span>
              </div>
            </div>
            <div className="bg-surface p-8 rounded-[48px] border border-subtle card-shadow space-y-6">
              <form onSubmit={handlePublishRide} className="space-y-8">
                <div className="space-y-6">
                  <LocationInput label="Origin" placeholder="Pickup point..." value={postFrom} onChange={setPostFrom} />
                  <LocationInput label="Destination" placeholder="Dropoff point..." value={postTo} onChange={setPostTo} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase text-muted ml-4 tracking-widest">Price / Seat</label>
                     <input type="number" value={postPrice} onChange={e => setPostPrice(parseInt(e.target.value))} className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-main border border-subtle" />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase text-muted ml-4 tracking-widest">Seats</label>
                     <input type="number" value={postSeats} onChange={e => setPostSeats(parseInt(e.target.value))} max={6} min={1} className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-main border border-subtle" />
                   </div>
                </div>
                <div className="flex bg-surface-alt p-1 rounded-2xl border border-subtle">
                  <button type="button" onClick={() => setPostVehicle(VehicleType.CAR)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${postVehicle === VehicleType.CAR ? 'bg-[var(--color-primary)] text-white' : 'text-muted'}`}>Car</button>
                  <button type="button" onClick={() => setPostVehicle(VehicleType.BIKE)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${postVehicle === VehicleType.BIKE ? 'bg-[#EA580C] text-white' : 'text-muted'}`}>Bike</button>
                </div>
                <button type="button" onClick={handleSuggestAi} disabled={isGeneratingAi || !postFrom || !postTo} className="w-full bg-surface-alt text-[var(--color-primary)] border border-[var(--color-primary)]/20 py-4 rounded-[24px] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50">
                  {isGeneratingAi ? <div className="w-4 h-4 border-2 border-[var(--color-primary)]/30 border-t-[var(--color-primary)] rounded-full animate-spin" /> : <>✨ Optimize with AI Copilot</>}
                </button>
                {postDescription && (
                  <div className="space-y-2 animate-in zoom-in-95">
                    <label className="text-[10px] font-black uppercase text-muted ml-4 tracking-widest">AI Description</label>
                    <textarea value={postDescription} onChange={e => setPostDescription(e.target.value)} className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-main border border-[var(--color-primary)]/30 outline-none focus:border-[var(--color-primary)] resize-none italic text-xs leading-relaxed" rows={3} />
                  </div>
                )}
                <button disabled={loading} className="w-full bg-[var(--color-primary)] text-white py-6 rounded-[30px] font-black text-xs uppercase tracking-widest shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3">{loading ? 'Publishing...' : 'Publish Ride'}</button>
              </form>
            </div>
          </div>
        );

      case 'PROFILE':
        return (
          <div className="p-8 space-y-8 animate-in fade-in pb-32">
            <div className="text-center space-y-6">
              <div className="relative inline-block">
                <img src={user?.avatar} className="w-32 h-32 mx-auto rounded-[48px] border-4 border-[var(--color-primary)] shadow-2xl" />
                <div className="absolute -bottom-2 -right-2 bg-[var(--color-primary)] p-2 rounded-xl text-white shadow-lg"><Icons.Check className="w-4 h-4" /></div>
              </div>
              <h2 className="text-3xl font-black italic uppercase text-main tracking-tighter">{user?.name}</h2>
              <div className="flex gap-2 justify-center">
                 {user?.driverVerificationStatus === 'VERIFIED' && <div className="bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20 text-[8px] font-black text-emerald-600 uppercase tracking-widest">Verified Driver</div>}
                 {user?.isVerified && <div className="bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20 text-[8px] font-black text-blue-600 uppercase tracking-widest">Verified ID</div>}
              </div>
               {/* Display New Profile Details */}
               <div className="grid grid-cols-2 gap-3 text-left">
                  <div className="bg-surface p-4 rounded-[24px] border border-subtle">
                      <p className="text-[8px] font-black text-muted uppercase tracking-widest">Sex</p>
                      <p className="text-xs font-bold">{user?.sex || 'N/A'}</p>
                  </div>
                  <div className="bg-surface p-4 rounded-[24px] border border-subtle">
                      <p className="text-[8px] font-black text-muted uppercase tracking-widest">Blood</p>
                      <p className="text-xs font-bold text-rose-500">{user?.bloodGroup || 'N/A'}</p>
                  </div>
                  <div className="bg-surface p-4 rounded-[24px] border border-subtle col-span-2">
                      <p className="text-[8px] font-black text-muted uppercase tracking-widest">Address</p>
                      <p className="text-xs font-bold truncate">{user?.address || 'N/A'}</p>
                  </div>
               </div>

              <div className="bg-surface p-6 rounded-[32px] border border-subtle card-shadow text-left space-y-4">
                <p className="text-[10px] font-black text-muted uppercase tracking-widest">Digital Wallet</p>
                <div className="flex justify-between items-center">
                   <p className="text-2xl font-black italic">₹{user?.balance || 0}</p>
                   <button onClick={() => setView('TOP_UP')} className="text-[10px] font-black text-[var(--color-primary)] uppercase bg-[var(--color-primary)]/10 px-4 py-2 rounded-xl active:scale-95 transition-all">Top Up +</button>
                </div>
              </div>
            </div>
            <div className="space-y-3 pt-4">
              <button onClick={() => setView('PROFILE_SETUP')} className="w-full bg-surface p-5 rounded-[24px] font-black text-[10px] uppercase border border-subtle tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3">Edit Profile Details</button>
              <button onClick={() => setView('CUSTOMER_KYC')} className={`w-full bg-surface p-5 rounded-[24px] font-black text-[10px] uppercase border border-subtle tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3 ${user?.isVerified ? 'opacity-50 pointer-events-none' : ''}`}><Icons.User className="w-4 h-4 text-[var(--color-primary)]" />{user?.isVerified ? 'Identity Verified' : 'Verify Identity'}</button>
              <button onClick={() => setView('DRIVER_KYC')} className={`w-full bg-surface p-5 rounded-[24px] font-black text-[10px] uppercase border border-subtle tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3 ${user?.driverVerificationStatus === 'VERIFIED' ? 'opacity-50 pointer-events-none' : ''}`}><Icons.Car className="w-4 h-4 text-[#EA580C]" />{user?.driverVerificationStatus === 'VERIFIED' ? 'Driver License Verified' : user?.driverVerificationStatus === 'PENDING' ? 'License Verification Pending' : 'Become a Driver'}</button>
              {isAdmin && <button onClick={() => setView('ADMIN_PANEL')} className="w-full bg-[#064E3B] text-white py-5 rounded-[24px] font-black text-[10px] uppercase border border-white/10 tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-emerald-900/20"><Icons.Shield className="w-4 h-4 text-[var(--color-primary)]" />Admin Panel</button>}
              <button onClick={() => authService.signOut()} className="w-full bg-rose-500/10 text-rose-500 py-5 rounded-[24px] font-black text-[10px] uppercase border border-rose-500/20 tracking-widest transition-all active:scale-95">Sign Out</button>
            </div>
          </div>
        );

      case 'CUSTOMER_KYC':
        return user ? <CustomerKYC user={user} onBack={() => setView('PROFILE')} onSuccess={async () => { await handleAuthUser(user); setView('PROFILE'); }} /> : null;
      case 'DRIVER_KYC':
        return user ? <DriverKYC user={user} onBack={() => setView('PROFILE')} onSuccess={async () => { await handleAuthUser(user); /* Stay here to show pending state */ }} /> : null;
      case 'ADMIN_PANEL':
        return <AdminKYCPanel onBack={() => setView('PROFILE')} />;
      case 'TOP_UP':
        return user ? <TopUpScreen user={user} onBack={() => setView('PROFILE')} onSuccess={async () => { await handleAuthUser(user); setView('PROFILE'); }} /> : null;
      case 'LIVE_TRACKING':
        return user && activeBooking ? <LiveTrackingScreen user={user} booking={activeBooking} onBack={() => setView('RECEIPT')} /> : null;

      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-app text-main max-w-xl mx-auto flex flex-col shadow-2xl relative overflow-hidden transition-colors duration-300">
      {view !== 'LOGIN' && view !== 'LIVE_TRACKING' && view !== 'CHAT' && view !== 'PROFILE_SETUP' && (
        <header className="px-8 py-6 flex justify-between items-center border-b border-subtle sticky top-0 bg-surface/90 backdrop-blur-xl z-50">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('HOME')}>
            <Icons.Logo className="w-8 h-8 text-[var(--color-primary)]" />
            <span className="font-black text-xl italic uppercase tracking-tighter text-[var(--color-primary)]">TripIn</span>
          </div>
          <button onClick={() => setView('PROFILE')} className="w-10 h-10 rounded-2xl overflow-hidden border-2 border-[var(--color-primary)] active:scale-95 transition-all shadow-md">
            <img src={user?.avatar} className="w-full h-full object-cover" />
          </button>
        </header>
      )}
      <main className="flex-1 overflow-y-auto custom-scroll pb-32">{renderView()}</main>
      {view !== 'LOGIN' && view !== 'ADMIN_PANEL' && view !== 'CUSTOMER_KYC' && view !== 'DRIVER_KYC' && view !== 'CHAT' && view !== 'TOP_UP' && view !== 'LIVE_TRACKING' && view !== 'PROFILE_SETUP' && (
        <nav className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-50">
          <div className="bg-white/80 backdrop-blur-3xl border border-subtle shadow-2xl rounded-[40px] px-8 py-5 flex justify-between items-center">
            <button onClick={() => setView('HOME')} className={`p-2 rounded-xl transition-all ${view === 'HOME' ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10' : 'text-muted hover:text-[var(--color-primary)]'}`}><Icons.Home /></button>
            <button onClick={() => setView('SEARCH')} className={`p-2 rounded-xl transition-all ${view === 'SEARCH' ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10' : 'text-muted hover:text-[var(--color-primary)]'}`}><Icons.Search /></button>
            <button onClick={handlePostRideNavigation} className={`p-2 rounded-xl transition-all ${view === 'POST' ? 'text-[#EA580C] bg-[#EA580C]/10' : 'text-muted hover:text-[#EA580C]'}`}><Icons.Plus /></button>
            <button onClick={() => setView('PROFILE')} className={`p-2 rounded-xl transition-all ${view === 'PROFILE' ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10' : 'text-muted hover:text-[var(--color-primary)]'}`}><Icons.User /></button>
          </div>
        </nav>
      )}
    </div>
  );
}