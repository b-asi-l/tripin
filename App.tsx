
import React, { useState, useEffect, useRef } from 'react';
import { 
  ViewState, 
  Trip, 
  VehicleType, 
  TripStatus, 
  User,
  Booking
} from './types';
import { Icons } from './constants';
import { authService, tripService, userService, bookingService, locationService } from './services/firebaseService';
import { generateTripDescription, suggestTripPrice } from './services/geminiService';
import { PaymentScreen } from './components/PaymentScreen';
import { ReceiptScreen } from './components/ReceiptScreen';
import { CustomerKYC } from './screens/CustomerKYC';
import { DriverKYC } from './screens/DriverKYC';
import { ChatScreen } from './screens/ChatScreen';
import { LiveTrackingScreen } from './screens/LiveTrackingScreen';
import { ProfileSetup } from './screens/ProfileSetup';
import { EarningsScreen } from './screens/EarningsScreen';
import { TopUpScreen } from './screens/TopUpScreen';
import { UberRequestScreen } from './screens/UberRequestScreen';

import { MapContainer as LeafletMap, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default icon path issues
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const MiniMap = ({ lat, lng }: { lat: number, lng: number }) => {
  return (
    <div className="h-full w-full rounded-[24px] overflow-hidden">
      <LeafletMap 
        center={[lat, lng]} 
        zoom={13} 
        zoomControl={false} 
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <Marker position={[lat, lng]} />
      </LeafletMap>
    </div>
  );
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
  const [showSignupSuccessModal, setShowSignupSuccessModal] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // Offer ride states
  const [postFrom, setPostFrom] = useState('');
  const [postTo, setPostTo] = useState('');
  const [postPrice, setPostPrice] = useState(150);
  const [postSeats, setPostSeats] = useState(3);
  const [currentCoords, setCurrentCoords] = useState<{lat: number, lng: number}>({ lat: 9.4981, lng: 76.3388 }); 
  const [isLocating, setIsLocating] = useState(false);

  const tripUnsubRef = useRef<(() => void) | null>(null);
  const currentAuthUserRef = useRef<any>(null);
  const isNewSignupRef = useRef(false);

  const handleAuthUser = async (authUser: any) => {
    if (!authUser) {
      setUser(null);
      setView('LOGIN');
      setLoading(false);
      return;
    }

    currentAuthUserRef.current = authUser;
    
    // 1. Check Email Verification
    if (!authUser.emailVerified) {
      if (isNewSignupRef.current) {
        setShowSignupSuccessModal(true);
        isNewSignupRef.current = false;
      }
      setView('EMAIL_VERIFICATION');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: profile } = await userService.getUserProfile(authUser.uid);
      if (!profile) {
        setView('PROFILE_SETUP');
        setLoading(false);
        return;
      }

      const userData = { ...profile } as User;
      setUser(userData);
      
      // Load active booking for dashboard
      const active = await bookingService.getActiveBooking(userData.id);
      if (active) setActiveBooking(active);

      if (!userData.isOnboarded) {
        setView('PROFILE_SETUP');
      } else if (!userData.kycData) {
        setView('CUSTOMER_KYC');
      } else if (userData.isDriver && (userData.driverVerificationStatus === 'NONE' || !userData.driverVerificationStatus)) {
        setView('DRIVER_KYC');
      } else {
        if (['LOGIN', 'EMAIL_VERIFICATION', 'PROFILE_SETUP', 'CUSTOMER_KYC', 'DRIVER_KYC'].includes(view)) {
          setView('HOME');
        }
      }
    } catch (e) {
      console.error("Auth user handling error:", e);
    } finally {
      setLoading(false);
    }
  };

  const refreshUserData = () => {
    if (currentAuthUserRef.current) {
      handleAuthUser(currentAuthUserRef.current);
    }
  };

  useEffect(() => {
    const unsubAuth = authService.onAuthStateChange(async (authUser) => {
      if (tripUnsubRef.current) {
        tripUnsubRef.current();
        tripUnsubRef.current = null;
      }

      if (authUser) {
        await handleAuthUser(authUser);
        tripUnsubRef.current = tripService.listenToTrips(setTrips);
      } else {
        currentAuthUserRef.current = null;
        setUser(null);
        setView('LOGIN');
        setTrips([]);
      }
      setAuthInitialized(true);
    });

    return () => {
      unsubAuth();
      if (tripUnsubRef.current) tripUnsubRef.current();
    };
  }, []);

  const fetchCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
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
            setPostFrom(parts[0] + (parts[1] ? ', ' + parts[1] : ''));
          }
        } catch (error) {
          console.error("Reverse geocoding error:", error);
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        alert("Unable to retrieve your location. Please check your GPS settings.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  if (!authInitialized) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-app text-emerald-600 font-black italic uppercase animate-pulse">
        TripIn Kerala...
      </div>
    );
  }

  const renderView = () => {
    switch(view) {
      case 'LOGIN':
        return (
          <div className="h-full overflow-y-auto bg-white flex flex-col relative animate-in fade-in">
            <nav className="p-6 flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur-md z-50">
              <div className="flex items-center gap-2">
                <Icons.Logo className="w-6 h-6 text-[#16A34A]" />
                <span className="text-xl font-black italic uppercase text-[#16A34A] tracking-tighter">TripIn</span>
              </div>
              <button onClick={() => setAuthMode('LOGIN')} className="bg-white border border-subtle text-main px-6 py-2 rounded-full text-[11px] font-black uppercase tracking-widest shadow-sm">Log In</button>
            </nav>
            <div className="px-6 py-8 flex flex-col items-center text-center space-y-6">
                <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100">🌲 KERALA'S OWN POOLING APP</div>
                <h1 className="text-5xl font-black text-main leading-[0.9] tracking-tighter">Share Ride,<br/><span className="text-[#16A34A]">Split Cost.</span></h1>
                <p className="text-muted text-sm font-medium leading-relaxed max-w-[280px]">Connect with verified professionals for a smarter commute. Save money, reduce traffic, and travel comfortably.</p>
                <div className="w-full max-w-sm bg-surface p-6 rounded-[40px] border border-subtle card-shadow space-y-6">
                    <div className="flex bg-surface-alt p-1 rounded-[24px]">
                        <button onClick={() => setAuthMode('LOGIN')} className={`flex-1 py-3 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${authMode === 'LOGIN' ? 'bg-white shadow-md text-main' : 'text-muted'}`}>Login</button>
                        <button onClick={() => setAuthMode('SIGNUP')} className={`flex-1 py-3 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${authMode === 'SIGNUP' ? 'bg-white shadow-md text-main' : 'text-muted'}`}>Sign Up</button>
                    </div>
                    <form onSubmit={async (e) => { 
                      e.preventDefault(); 
                      setLoading(true); 
                      try {
                        if (authMode === 'SIGNUP') {
                          isNewSignupRef.current = true;
                          const res = await authService.signUp(email, password, name);
                          if (res.error) {
                            isNewSignupRef.current = false;
                            alert(res.error.message);
                          }
                        } else {
                          const res = await authService.signIn(email, password);
                          if (res.error) alert(res.error.message);
                        }
                      } catch (err: any) {
                        isNewSignupRef.current = false;
                        alert(err.message || "An unexpected error occurred.");
                      } finally {
                        setLoading(false);
                      }
                    }} className="space-y-4">
                        {authMode === 'SIGNUP' && <input value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-sm outline-none border border-transparent focus:border-[#16A34A]" required />}
                        <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email Address" className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-sm outline-none border border-transparent focus:border-[#16A34A]" required />
                        <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Password" className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-sm outline-none border border-transparent focus:border-[#16A34A]" required />
                        <button disabled={loading} className="w-full bg-[#16A34A] text-white py-5 rounded-[24px] font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                          {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                          {loading ? 'Processing...' : (authMode === 'LOGIN' ? 'Login to TripIn' : 'Create Account')}
                        </button>
                    </form>

                     <div className="flex items-center gap-4">
                        <div className="h-px bg-subtle flex-1"></div>
                        <span className="text-[10px] font-black uppercase text-muted tracking-widest">OR</span>
                        <div className="h-px bg-subtle flex-1"></div>
                    </div>

                    <button 
                        onClick={async () => {
                            setLoading(true);
                            const res = await authService.signInWithGoogle();
                            if (res.error) {
                                alert(res.error.message);
                                setLoading(false);
                            }
                        }}
                        disabled={loading}
                        className="w-full bg-white text-main border border-subtle py-5 rounded-[24px] font-black text-xs uppercase tracking-widest shadow-sm active:scale-95 transition-all flex items-center justify-center gap-3"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26c.01-.19.01-.38.01-.58z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Continue with Google
                    </button>
                </div>
            </div>
          </div>
        );
      case 'EMAIL_VERIFICATION':
        return (
          <div className="h-full bg-white flex flex-col items-center justify-center p-8 animate-in zoom-in-95">
             <div className="w-full max-w-sm bg-white p-10 rounded-[48px] border border-subtle card-shadow text-center space-y-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500 rounded-t-[48px]"></div>
                <div className="w-24 h-24 bg-emerald-50 rounded-full mx-auto flex items-center justify-center text-[#16A34A]">
                    <Icons.Send className="w-12 h-12" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-black italic uppercase text-main tracking-tighter italic">Verify Email</h2>
                  <p className="text-muted text-[11px] font-medium leading-relaxed">
                      We've sent a verification link to <br/>
                      <span className="text-main font-bold break-all">{currentAuthUserRef.current?.email || email}</span>. <br/>
                      Please click it to proceed.
                  </p>
                </div>
                <div className="space-y-3 pt-4">
                  <button onClick={() => window.location.reload()} className="w-full bg-[#16A34A] text-white py-6 rounded-[24px] font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all">I've Verified My Email</button>
                  <button onClick={() => authService.signOut()} className="w-full text-muted py-2 text-[10px] font-black uppercase tracking-widest hover:text-rose-500 transition-colors">Log Out</button>
                </div>
            </div>
          </div>
        );
      case 'HOME':
        return (
          <div className="p-6 space-y-8 animate-in fade-in pb-32">
            <div className="space-y-1"><p className="text-[10px] font-black uppercase text-muted tracking-widest">Good Morning,</p><h1 className="text-4xl font-black italic text-main tracking-tighter">{user?.name}</h1></div>
            
            <div className="bg-white p-6 rounded-[40px] border border-subtle shadow-lg space-y-6">
                <div className="flex justify-between items-center"><h3 className="text-xs font-black uppercase italic tracking-widest text-main">Eco-Warrior Status</h3><div className="bg-surface-alt px-3 py-1 rounded-full text-[9px] font-bold text-muted uppercase tracking-widest">{user?.tripsCount || 0} Trips</div></div>
                <div className="flex items-center gap-2"><h2 className="text-3xl font-black italic text-main uppercase">Level {user?.level || 1}</h2><Icons.Shield className="w-6 h-6 text-emerald-500" /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-[#10b981] to-[#059669] p-5 rounded-[28px] text-white relative overflow-hidden">
                        <p className="text-2xl font-black">{(user?.co2Saved || 0).toFixed(2)}kg</p><p className="text-[9px] font-bold uppercase opacity-80">CO2 Saved</p>
                        <Icons.Leaf className="absolute -bottom-2 -right-2 w-12 h-12 opacity-10" />
                    </div>
                    <div className="bg-gradient-to-br from-[#3b82f6] to-[#2563eb] p-5 rounded-[28px] text-white relative overflow-hidden">
                        <p className="text-2xl font-black">₹{(user?.moneySaved || 0).toFixed(2)}</p><p className="text-[9px] font-bold uppercase opacity-80">Fuel Saved</p>
                        <Icons.Wallet className="absolute -bottom-2 -right-2 w-12 h-12 opacity-10" />
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setView('SEARCH')} className="bg-white p-6 rounded-[40px] border border-subtle shadow-md text-left h-44 flex flex-col justify-between active:scale-95 transition-all">
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-[#16A34A]"><Icons.Search /></div>
                    <div><p className="text-xl font-black text-main italic uppercase">Find<br/>Pool</p><p className="text-[9px] font-bold text-muted uppercase mt-1">Commute & Save</p></div>
                </button>
                <button onClick={() => setView('POST')} className="bg-[#EA580C] p-6 rounded-[40px] shadow-xl text-left h-44 flex flex-col justify-between active:scale-95 transition-all text-white">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center"><Icons.Plus /></div>
                    <div><p className="text-xl font-black italic uppercase">Offer<br/>Ride</p><p className="text-[9px] font-bold opacity-80 uppercase mt-1">Share & Earn</p></div>
                </button>
            </div>

            {/* Uber On-Demand Ride Button */}
            <button onClick={() => setView('UBER')} className="w-full bg-main text-white p-6 rounded-[40px] shadow-2xl flex items-center justify-between active:scale-95 transition-all mt-4 relative overflow-hidden">
                <div className="absolute -right-10 -bottom-10 opacity-20"><Icons.Car className="w-40 h-40" /></div>
                <div className="relative z-10 text-left">
                    <p className="text-3xl font-black italic uppercase tracking-tighter">Ride Now</p>
                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mt-1">On-Demand Private Car</p>
                </div>
                <div className="relative z-10 w-14 h-14 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md">
                    <span className="text-2xl">→</span>
                </div>
            </button>

            {/* LIVE POOL SECTION (Updated as per user's screenshot) */}
            {activeBooking && (
              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-2 px-4">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <h3 className="text-[10px] font-black uppercase text-muted tracking-widest">Live Pool</h3>
                </div>
                <div onClick={() => setView('RECEIPT')} className="bg-gradient-to-br from-gray-100 to-gray-200 p-6 rounded-[32px] border border-subtle/50 shadow-inner flex items-center justify-between active:scale-95 transition-all cursor-pointer relative overflow-hidden">
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm">
                      <Icons.Car className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-main leading-tight tracking-tight">
                        {activeBooking.from.split(',')[0]} <span className="text-emerald-600">→</span> {activeBooking.to.split(',')[0]}
                      </p>
                      <p className="text-[8px] font-bold text-muted uppercase tracking-widest mt-1">
                        Driver: {activeBooking.ownerName}
                      </p>
                    </div>
                  </div>
                  <div className="bg-white px-3 py-1.5 rounded-full text-[8px] font-black text-emerald-600 uppercase tracking-widest shadow-sm relative z-10">
                    Active
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      case 'PROFILE':
        return (
          <div className="p-8 space-y-8 animate-in fade-in pb-32">
            <div className="text-center space-y-4">
              <div className="relative inline-block"><img src={user?.avatar} className="w-32 h-32 rounded-full mx-auto border-4 border-[#16A34A] shadow-2xl" />{user?.isVerified && <div className="absolute bottom-0 right-0 bg-white p-1.5 rounded-full shadow-lg text-emerald-500"><Icons.Shield className="w-5 h-5" /></div>}</div>
              <h2 className="text-4xl font-black italic uppercase text-main tracking-tighter">{user?.name}</h2>
            </div>
            <div className="space-y-3">
              <button onClick={() => setView('CUSTOMER_KYC')} className="w-full bg-amber-50 text-amber-700 p-5 rounded-[24px] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"><Icons.Shield className="w-4 h-4" /> Verify Identity</button>
              {user?.isDriver && (
                <button onClick={() => setView('DRIVER_KYC')} className="w-full bg-blue-50 text-blue-700 p-5 rounded-[24px] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"><Icons.Car className="w-4 h-4" /> Driver Documents</button>
              )}
              <button onClick={() => setView('PROFILE_SETUP')} className="w-full bg-white border border-subtle text-main p-5 rounded-[24px] font-black text-[10px] uppercase tracking-widest">Edit Profile</button>
              
              <button onClick={() => setView('ABOUT')} className="w-full bg-white border border-subtle text-main p-5 rounded-[24px] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
                 <Icons.Info className="w-4 h-4" /> About & Legal
              </button>

              <button onClick={() => authService.signOut()} className="w-full bg-rose-50 text-rose-500 p-5 rounded-[24px] font-black text-[10px] uppercase tracking-widest">Sign Out</button>
            </div>
          </div>
        );
      case 'ABOUT':
        return (
          <div className="p-8 space-y-8 animate-in slide-in-from-right-8 pb-32">
             <div className="flex items-center gap-4">
              <button onClick={() => setView('PROFILE')} className="bg-white p-3 rounded-xl border border-subtle text-main shadow-sm active:scale-95 transition-all">←</button>
              <h2 className="text-2xl font-black italic uppercase text-main">About & Legal</h2>
            </div>
            <div className="space-y-4">
              <button onClick={() => setView('CONTACT_US')} className="w-full bg-white p-6 rounded-[32px] border border-subtle shadow-sm flex items-center justify-between group active:scale-95 transition-all">
                 <span className="font-bold text-main uppercase tracking-widest text-xs">Contact Us</span>
                 <span className="text-muted group-hover:translate-x-1 transition-transform">→</span>
              </button>
              <button onClick={() => setView('TERMS')} className="w-full bg-white p-6 rounded-[32px] border border-subtle shadow-sm flex items-center justify-between group active:scale-95 transition-all">
                 <span className="font-bold text-main uppercase tracking-widest text-xs">Terms & Conditions</span>
                 <span className="text-muted group-hover:translate-x-1 transition-transform">→</span>
              </button>
              <button onClick={() => setView('REFUND_POLICY')} className="w-full bg-white p-6 rounded-[32px] border border-subtle shadow-sm flex items-center justify-between group active:scale-95 transition-all">
                 <span className="font-bold text-main uppercase tracking-widest text-xs">Cancellation & Refund Policy</span>
                 <span className="text-muted group-hover:translate-x-1 transition-transform">→</span>
              </button>
            </div>
          </div>
        );
      case 'CONTACT_US':
        return (
           <div className="p-8 space-y-6 animate-in slide-in-from-right-8 pb-32">
             <div className="flex items-center gap-4">
              <button onClick={() => setView('ABOUT')} className="bg-white p-3 rounded-xl border border-subtle text-main shadow-sm active:scale-95 transition-all">←</button>
              <h2 className="text-2xl font-black italic uppercase text-main">Contact Us</h2>
            </div>
            <div className="bg-white p-6 rounded-[32px] border border-subtle shadow-lg space-y-6 text-sm text-main leading-relaxed">
               <div className="border-b border-subtle pb-4">
                  <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-1">Merchant Name</p>
                  <p className="font-bold">BASIL MATHEW</p>
               </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-1">Registered Address</p>
                  <p>PULIMOOTTIL HOUSE KUTHIKUZHI PO AMBALAPARAMBU KOTHAMANGALAM, KOTHAMANGALAM, Kerala, PIN: 686691</p>
               </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-1">Operational Address</p>
                  <p>PULIMOOTTIL HOUSE KUTHIKUZHI PO AMBALAPARAMBU KOTHAMANGALAM, KOTHAMANGALAM, Kerala, PIN: 686691</p>
               </div>
               <div>
                  <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-1">Phone</p>
                  <p>7907122132</p>
               </div>
               <div>
                  <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-1">Email</p>
                  <p>basilmathewin@gmail.com</p>
               </div>
            </div>
           </div>
        );
      case 'TERMS':
        return (
           <div className="p-8 space-y-6 animate-in slide-in-from-right-8 pb-32">
             <div className="flex items-center gap-4">
              <button onClick={() => setView('ABOUT')} className="bg-white p-3 rounded-xl border border-subtle text-main shadow-sm active:scale-95 transition-all">←</button>
              <h2 className="text-2xl font-black italic uppercase text-main">Terms</h2>
            </div>
            <div className="bg-white p-6 rounded-[32px] border border-subtle shadow-lg space-y-4 text-xs text-main leading-relaxed h-[60vh] overflow-y-auto custom-scroll">
               <p className="font-bold">Last updated on 18-02-2026 22:22:42</p>
               <p>These Terms and Conditions, along with privacy policy or other terms (“Terms”) constitute a binding agreement by and between BASIL MATHEW, ( “Website Owner” or “we” or “us” or “our”) and you (“you” or “your”) and relate to your use of our website, goods (as applicable) or services (as applicable) (collectively, “Services”).</p>
               <p>By using our website and availing the Services, you agree that you have read and accepted these Terms (including the Privacy Policy). We reserve the right to modify these Terms at any time and without assigning any reason. It is your responsibility to periodically review these Terms to stay informed of updates.</p>
               <p>The use of this website or availing of our Services is subject to the following terms of use:</p>
               <ul className="list-disc pl-4 space-y-2">
                 <li>To access and use the Services, you agree to provide true, accurate and complete information to us during and after registration, and you shall be responsible for all acts done through the use of your registered account.</li>
                 <li>Neither we nor any third parties provide any warranty or guarantee as to the accuracy, timeliness, performance, completeness or suitability of the information and materials offered on this website or through the Services, for any specific purpose. You acknowledge that such information and materials may contain inaccuracies or errors and we expressly exclude liability for any such inaccuracies or errors to the fullest extent permitted by law.</li>
                 <li>Your use of our Services and the websiteis solely at your own risk and discretion.. You are required to independently assess and ensure that the Services meet your requirements.</li>
                 <li>The contents of the Website and the Services are proprietary to Us and you will not have any authority to claim any intellectual property rights, title, or interest in its contents.</li>
                 <li>You acknowledge that unauthorized use of the Website or the Services may lead to action against you as per these Terms or applicable laws.</li>
                 <li>You agree to pay us the charges associated with availing the Services.</li>
                 <li>You agree not to use the website and/ or Services for any purpose that is unlawful, illegal or forbidden by these Terms, or Indian or local laws that might apply to you.</li>
                 <li>You agree and acknowledge that website and the Services may contain links to other third party websites. On accessing these links, you will be governed by the terms of use, privacy policy and such other policies of such third party websites.</li>
                 <li>You understand that upon initiating a transaction for availing the Services you are entering into a legally binding and enforceable contract with the us for the Services.</li>
                 <li>You shall be entitled to claim a refund of the payment made by you in case we are not able to provide the Service. The timelines for such return and refund will be according to the specific Service you have availed or within the time period provided in our policies (as applicable). In case you do not raise a refund claim within the stipulated time, than this would make you ineligible for a refund.</li>
                 <li>Notwithstanding anything contained in these Terms, the parties shall not be liable for any failure to perform an obligation under these Terms if performance is prevented or delayed by a force majeure event.</li>
                 <li>These Terms and any dispute or claim relating to it, or its enforceability, shall be governed by and construed in accordance with the laws of India.</li>
                 <li>All disputes arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts in KOTHAMANGALAM, Kerala</li>
                 <li>All concerns or communications relating to these Terms must be communicated to us using the contact information provided on this website.</li>
               </ul>
            </div>
           </div>
        );
      case 'REFUND_POLICY':
        return (
           <div className="p-8 space-y-6 animate-in slide-in-from-right-8 pb-32">
             <div className="flex items-center gap-4">
              <button onClick={() => setView('ABOUT')} className="bg-white p-3 rounded-xl border border-subtle text-main shadow-sm active:scale-95 transition-all">←</button>
              <h2 className="text-xl font-black italic uppercase text-main">Refund Policy</h2>
            </div>
            <div className="bg-white p-6 rounded-[32px] border border-subtle shadow-lg space-y-4 text-xs text-main leading-relaxed h-[60vh] overflow-y-auto custom-scroll">
               <p className="font-bold">Last updated on 18-02-2026 22:23:45</p>
               <p>BASIL MATHEW believes in helping its customers as far as possible, and has therefore a liberal cancellation policy. Under this policy:</p>
               <ul className="list-disc pl-4 space-y-2">
                 <li>Cancellations will be considered only if the request is made immediately after placing the order. However, the cancellation request may not be entertained if the orders have been communicated to the vendors/merchants and they have initiated the process of shipping them.</li>
                 <li>BASIL MATHEW does not accept cancellation requests for perishable items like flowers, eatables etc. However, refund/replacement can be made if the customer establishes that the quality of product delivered is not good.</li>
                 <li>In case of receipt of damaged or defective items please report the same to our Customer Service team. The request will, however, be entertained once the merchant has checked and determined the same at his own end. This should be reported within Only same day days of receipt of the products. In case you feel that the product received is not as shown on the site or as per your expectations, you must bring it to the notice of our customer service within Only same day days of receiving the product. The Customer Service Team after looking into your complaint will take an appropriate decision.</li>
                 <li>In case of complaints regarding products that come with a warranty from manufacturers, please refer the issue to them. In case of any Refunds approved by the BASIL MATHEW, it’ll take 6-8 Days days for the refund to be processed to the end customer.</li>
               </ul>
            </div>
           </div>
        );
      case 'POST':
        return (
          <div className="p-8 space-y-8 pb-40">
            <h2 className="text-4xl font-black italic uppercase text-main italic">Offer Ride</h2>
            <div className="h-48 rounded-[32px] overflow-hidden shadow-lg">
              <MiniMap lat={currentCoords.lat} lng={currentCoords.lng} />
            </div>
            <div className="bg-white p-8 rounded-[40px] border border-subtle shadow-xl space-y-6">
                <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-4">Origin</label>
                    <div className="relative">
                      <input value={postFrom} onChange={e => setPostFrom(e.target.value)} placeholder="Pickup Location" className="w-full bg-surface-alt p-5 pr-14 rounded-[24px] font-bold text-sm outline-none border border-transparent focus:border-[#16A34A]" />
                      <button type="button" onClick={fetchCurrentLocation} disabled={isLocating} className={`absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full transition-all ${isLocating ? 'animate-pulse bg-emerald-100' : 'hover:bg-emerald-50'}`}><Icons.Target className={`w-6 h-6 ${isLocating ? 'text-emerald-300' : 'text-emerald-500'}`} /></button>
                    </div>
                    <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-4">Destination</label>
                    <input value={postTo} onChange={e => setPostTo(e.target.value)} placeholder="Search dropoff..." className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-sm outline-none border border-transparent focus:border-[#16A34A]" />
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><label className="text-[10px] font-black uppercase text-muted ml-4 tracking-widest">Price / Seat</label><input type="number" value={postPrice} onChange={e => setPostPrice(parseInt(e.target.value))} className="w-full bg-surface-alt p-5 rounded-[24px] font-black" /></div>
                        <div className="space-y-2"><label className="text-[10px] font-black uppercase text-muted ml-4 tracking-widest">Seats</label><input type="number" value={postSeats} onChange={e => setPostSeats(parseInt(e.target.value))} className="w-full bg-surface-alt p-5 rounded-[24px] font-black" /></div>
                    </div>
                    <button onClick={async () => { await tripService.createTrip({ ownerId: user?.id, ownerName: user?.name, ownerAvatar: user?.avatar, ownerPhone: user?.phone || '', from: postFrom, to: postTo, pricePerSeat: postPrice, availableSeats: postSeats, status: 'OPEN', vehicleType: 'CAR', date: 'Today', time: '18:00' }); setView('HOME'); }} className="w-full bg-[#16A34A] text-white py-6 rounded-[30px] font-black text-xs uppercase shadow-2xl mt-4">Publish Ride</button>
                </div>
            </div>
          </div>
        );
      case 'PAYMENT': return selectedTrip && user ? <PaymentScreen trip={selectedTrip} user={user} onBack={() => setView('TRIP_DETAIL')} onPaymentSuccess={(booking) => { setActiveBooking(booking); setView('RECEIPT'); }} /> : null;
      case 'RECEIPT': return activeBooking ? <ReceiptScreen booking={activeBooking} onHome={() => setView('HOME')} onTrack={() => setView('LIVE_TRACKING')} onChat={() => setView('CHAT')} onCancelSuccess={() => { setActiveBooking(null); setView('HOME'); }} /> : null;
      case 'CHAT': return activeBooking && user ? <ChatScreen booking={activeBooking} currentUser={user} onBack={() => setView('RECEIPT')} /> : null;
      case 'CUSTOMER_KYC': return user ? <CustomerKYC user={user} onBack={() => setView('PROFILE')} onSuccess={refreshUserData} /> : null;
      case 'DRIVER_KYC': return user ? <DriverKYC user={user} onBack={() => setView('PROFILE')} onSuccess={refreshUserData} /> : null;
      case 'PROFILE_SETUP': return user ? <ProfileSetup user={user} onSuccess={refreshUserData} /> : null;
      case 'SEARCH':
        return (
          <div className="p-8 space-y-8 pb-40">
            <h2 className="text-4xl font-black italic uppercase text-main tracking-tighter">Find Pool</h2>
            <div className="space-y-4">
              {trips.length > 0 ? trips.map(trip => (
                <div key={trip.id} onClick={() => { setSelectedTrip(trip); setView('TRIP_DETAIL'); }} className="bg-white p-6 rounded-[32px] border border-subtle shadow-md flex justify-between items-center active:scale-95 transition-all">
                  <div className="flex items-center gap-4"><img src={trip.ownerAvatar} className="w-14 h-14 rounded-2xl border border-subtle" /><div><p className="text-xs font-black uppercase text-main">{trip.ownerName}</p><p className="text-[10px] font-bold text-muted uppercase tracking-widest">{trip.from} → {trip.to}</p></div></div>
                  <div className="text-right"><p className="text-xl font-black text-[#16A34A] italic">₹{trip.pricePerSeat}</p></div>
                </div>
              )) : <div className="text-center py-20 opacity-30 font-black uppercase text-xs">No active pools nearby</div>}
            </div>
          </div>
        );
      case 'TRIP_DETAIL':
        return selectedTrip && (
          <div className="p-8 space-y-8">
            <button onClick={() => setView('SEARCH')} className="text-muted text-[10px] font-black uppercase tracking-widest">← Back to Search</button>
            <div className="bg-white p-8 rounded-[48px] border border-subtle shadow-2xl space-y-8 relative overflow-hidden">
                <div className="h-48 rounded-[32px] overflow-hidden"><MiniMap lat={10.8505} lng={76.2711} /></div>
                <div className="flex items-center gap-5">
                    <img src={selectedTrip.ownerAvatar} className="w-24 h-24 rounded-[32px] border-4 border-emerald-50 shadow-lg" />
                    <div className="space-y-1">
                        <h3 className="text-2xl font-black italic uppercase text-main">{selectedTrip.ownerName}</h3>
                        <div className="bg-emerald-50 px-3 py-1 rounded-full text-[10px] font-black text-emerald-600 uppercase tracking-widest inline-block">Verified Citizen</div>
                    </div>
                </div>
                <button onClick={() => setView('PAYMENT')} className="w-full bg-[#16A34A] text-white py-6 rounded-[32px] font-black text-xs uppercase shadow-2xl active:scale-95 transition-all">Book Seat (₹{selectedTrip.pricePerSeat})</button>
            </div>
          </div>
        );
      case 'LIVE_TRACKING': return user && activeBooking ? <LiveTrackingScreen user={user} booking={activeBooking} onBack={() => setView('RECEIPT')} /> : null;
      case 'EARNINGS': return user ? <EarningsScreen user={user} onBack={() => setView('PROFILE')} onSuccess={refreshUserData} /> : null;
      case 'TOPUP': return user ? <TopUpScreen user={user} onBack={() => setView('PROFILE')} onSuccess={refreshUserData} /> : null;
      case 'UBER': return user ? <UberRequestScreen user={user} onBack={() => setView('HOME')} onRideAccepted={(booking) => { setActiveBooking(booking); setView('LIVE_TRACKING'); }} /> : null;
      default: return null;
    }
  };

  return (
    <div className="h-[100dvh] w-full bg-app text-main mx-auto flex flex-col shadow-2xl relative overflow-hidden max-w-lg">
      {showSignupSuccessModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[48px] p-8 text-center space-y-6 shadow-2xl animate-in zoom-in-95">
            <div className="w-24 h-24 bg-emerald-100 rounded-full mx-auto flex items-center justify-center text-emerald-600 border-4 border-emerald-50"><Icons.Check className="w-12 h-12" /></div>
            <div className="space-y-2"><h2 className="text-3xl font-black italic uppercase text-main tracking-tighter">Account created!</h2><p className="text-muted text-sm font-medium leading-relaxed px-4">Please verify your email to <br/><span className="text-emerald-600 font-black italic uppercase">login to your account</span>.</p></div>
            <div className="bg-emerald-50 p-6 rounded-[32px] border border-emerald-100/50"><p className="text-[10px] font-black uppercase text-emerald-800 tracking-widest leading-relaxed">A link has been sent to {email}. Click it to proceed.</p></div>
            <button onClick={() => setShowSignupSuccessModal(false)} className="w-full bg-[#16A34A] text-white py-6 rounded-[28px] font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all">Verify My Email Now</button>
          </div>
        </div>
      )}

      {view !== 'LOGIN' && view !== 'EMAIL_VERIFICATION' && (
        <header className="px-6 py-4 flex justify-between items-center border-b border-subtle bg-white/90 backdrop-blur-xl z-50">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('HOME')}><Icons.Logo className="w-8 h-8 text-[#16A34A]" /><span className="font-black text-xl italic uppercase text-[#16A34A] tracking-tighter">TripIn</span></div>
          <button onClick={() => setView('PROFILE')} className="w-10 h-10 rounded-2xl overflow-hidden border-2 border-[#16A34A] shadow-md transition-transform active:scale-90"><img src={user?.avatar} className="w-full h-full object-cover" /></button>
        </header>
      )}
      
      <main className="flex-1 overflow-y-auto custom-scroll w-full relative">{renderView()}</main>

      {view !== 'LOGIN' && view !== 'EMAIL_VERIFICATION' && (
        <nav className="fixed bottom-0 left-0 w-full z-50 bg-white/95 border-t border-subtle pb-safe backdrop-blur-md">
           <div className="flex justify-around items-center px-4 py-3 max-w-lg mx-auto">
            <button onClick={() => setView('HOME')} className={`p-4 rounded-3xl transition-all ${view === 'HOME' ? 'text-[#16A34A] bg-emerald-50' : 'text-muted hover:bg-surface-alt'}`}><Icons.Home /></button>
            <button onClick={() => setView('SEARCH')} className={`p-4 rounded-3xl transition-all ${view === 'SEARCH' || view === 'TRIP_DETAIL' ? 'text-[#16A34A] bg-emerald-50' : 'text-muted hover:bg-surface-alt'}`}><Icons.Search /></button>
            <button onClick={() => setView('POST')} className={`p-4 rounded-3xl transition-all ${view === 'POST' ? 'text-[#EA580C] bg-orange-50' : 'text-muted hover:bg-surface-alt'}`}><Icons.Plus /></button>
            <button onClick={() => setView('PROFILE')} className={`p-4 rounded-3xl transition-all ${['PROFILE', 'EARNINGS', 'TOPUP', 'CUSTOMER_KYC', 'DRIVER_KYC', 'PROFILE_SETUP', 'ABOUT', 'CONTACT_US', 'TERMS', 'REFUND_POLICY'].includes(view) ? 'text-[#16A34A] bg-emerald-50' : 'text-muted hover:bg-surface-alt'}`}><Icons.User /></button>
          </div>
        </nav>
      )}
    </div>
  );
}
