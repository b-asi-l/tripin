import { Trip, Booking, TripStatus, LiveLocation, DriverTransaction } from '../types';

// Mock user data
const mockUser = {
  uid: "mock-user-123",
  id: "mock-user-123",
  email: "demo@tripin.in",
  displayName: "Demo User",
  name: "Demo User",
  photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=DemoUser",
  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=DemoUser",
  role: "customer",
  isDriver: false,
  rating: 5.0,
  tripsCount: 2,
  isOnboarded: true,
  isVerified: true,
  co2Saved: 10,
  moneySaved: 50,
  fuelSaved: 5,
  walletBalance: 1500,
  earnings: 0,
  level: 2,
  createdAt: Date.now()
};

let authStateCallback: any = null;
let currentMockUser: any = null;

// Helper to simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const authService = {
  signUp: async (email: string, password: string, name: string) => {
    await delay(500);
    currentMockUser = { ...mockUser, email, name, displayName: name };
    if (authStateCallback) authStateCallback(currentMockUser);
    return { data: { user: currentMockUser }, error: null };
  },
  
  signIn: async (email: string, password: string) => {
    await delay(500);
    currentMockUser = { ...mockUser, email };
    if (authStateCallback) authStateCallback(currentMockUser);
    return { data: { user: currentMockUser }, error: null };
  },

  signInWithGoogle: async () => {
    await delay(500);
    currentMockUser = { ...mockUser };
    if (authStateCallback) authStateCallback(currentMockUser);
    return { data: { user: currentMockUser }, error: null };
  },

  onAuthStateChange: (callback: (user: any) => void) => {
    authStateCallback = callback;
    // Call immediately if user already exists
    if (currentMockUser) {
        callback(currentMockUser);
    } else {
        // Mock checking auth state initially, then auto login for demo
        setTimeout(() => {
           currentMockUser = { ...mockUser };
           callback(currentMockUser);
        }, 1000);
    }
    return () => { authStateCallback = null; };
  },

  signOut: async () => {
    await delay(500);
    currentMockUser = null;
    if (authStateCallback) authStateCallback(null);
  }
};

export const userService = {
  getUserProfile: async (uid: string) => {
    await delay(300);
    return { data: { ...currentMockUser, driverVerificationStatus: 'VERIFIED' }, error: null };
  },
  
  updateProfile: async (uid: string, data: any) => {
    await delay(300);
    currentMockUser = { ...currentMockUser, ...data };
    return { data: currentMockUser, error: null };
  },

  topUpBalance: async (uid: string, amount: number) => {
    await delay(300);
    if (currentMockUser) {
        currentMockUser.walletBalance += amount;
    }
    return { error: null };
  }
};

let mockTrips: Trip[] = [
    {
        id: "trip-1",
        driverId: "mock-user-123",
        driverName: "John Doe",
        driverAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=JohnDoe",
        origin: { name: "Kochi", lat: 9.9312, lng: 76.2673 },
        destination: { name: "Trivandrum", lat: 8.5241, lng: 76.9366 },
        departureTime: Date.now() + 86400000, // tomorrow
        pricePerSeat: 500,
        availableSeats: 3,
        carModel: "Toyota Innova",
        status: "OPEN" as TripStatus,
        createdAt: Date.now()
    },
    {
        id: "trip-2",
        driverId: "driver-456",
        driverName: "Alice Smith",
        driverAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alice",
        origin: { name: "Calicut", lat: 11.2588, lng: 75.7804 },
        destination: { name: "Kochi", lat: 9.9312, lng: 76.2673 },
        departureTime: Date.now() + 172800000, 
        pricePerSeat: 400,
        availableSeats: 2,
        carModel: "Honda City",
        status: "OPEN" as TripStatus,
        createdAt: Date.now() - 3600000
    }
];

export const tripService = {
  listenToTrips: (callback: (trips: Trip[]) => void) => {
    // Send immediate initial data
    callback(mockTrips.filter(t => t.status === 'OPEN'));
    // Return unsubscribe function
    return () => {};
  },
  
  createTrip: async (tripData: any) => {
    await delay(500);
    const newTrip = { id: `trip-${Date.now()}`, ...tripData, createdAt: Date.now() };
    mockTrips.push(newTrip);
    return { data: newTrip, error: null };
  }
};

let mockBookings: Booking[] = [];

export const bookingService = {
  createBooking: async (bookingData: any, paymentMethod: string) => {
    await delay(500);
    const newBooking = {
        ...bookingData,
        id: `booking-${Date.now()}`,
        riderId: bookingData.userId,
        driverId: bookingData.driverId,
        paymentMethod,
        status: 'CONFIRMED',
        createdAt: Date.now()
    };
    mockBookings.push(newBooking);

    if (paymentMethod === 'WALLET' && currentMockUser) {
       currentMockUser.walletBalance -= (bookingData.amount + 5);
       currentMockUser.tripsCount += 1;
       currentMockUser.co2Saved += 0.8;
       currentMockUser.moneySaved += (bookingData.amount * 0.5);
    }
    
    // Update trip seats
    const trip = mockTrips.find(t => t.id === bookingData.tripId);
    if (trip) {
        trip.availableSeats -= 1;
        if (trip.availableSeats === 0) trip.status = 'FULL' as TripStatus;
    }

    return { data: newBooking, error: null };
  },

  cancelBooking: async (bookingId: string, tripId: string, userId: string, refundAmount: number) => {
    await delay(300);
    const booking = mockBookings.find(b => b.id === bookingId);
    if (booking) booking.status = 'CANCELLED';
    
    const trip = mockTrips.find(t => t.id === tripId);
    if (trip) {
        trip.availableSeats += 1;
        trip.status = 'OPEN' as TripStatus;
    }

    if (booking?.paymentMethod !== 'DIRECT' && currentMockUser) {
        currentMockUser.walletBalance += refundAmount;
    }
    
    return { success: true };
  },

  getActiveBooking: async (uid: string) => {
    await delay(200);
    const active = mockBookings.filter(b => b.riderId === uid && b.status === 'CONFIRMED')
                               .sort((a, b) => b.createdAt - a.createdAt);
    return active.length > 0 ? active[0] : null;
  },

  getUserBookings: async (uid: string) => {
    await delay(200);
    return mockBookings.filter(b => b.riderId === uid);
  }
};

export const driverService = {
  recalculateEarnings: async (uid: string) => {
    await delay(300);
    return 1200; // Mock total
  },

  getEarningsHistory: async (uid: string) => {
    await delay(300);
    return { data: [] };
  },

  redeemEarnings: async (uid: string, amount: number, bank: any) => {
    await delay(500);
    if (currentMockUser) currentMockUser.earnings = 0;
    return { success: true };
  },

  saveBankDetails: async (uid: string, bank: any) => {
    await delay(300);
    return { success: true };
  }
};

export const locationService = {
  updateUserLocation: async (uid: string, loc: LiveLocation) => {
    // No-op for mock
  },
  listenToUserLocation: (uid: string, callback: (loc: LiveLocation | null) => void) => {
    callback({ lat: 9.9312, lng: 76.2673, heading: 90, speed: 40 });
    return () => {};
  }
};

let mockMessages: any[] = [];
export const chatService = {
  ensureChatExists: async (id: string, participants: string[]) => {
    return { success: true };
  },
  sendMessage: async (id: string, text: string) => {
    if (!currentMockUser) return { error: "Auth required" };
    mockMessages.push({ id: Date.now().toString(), senderId: currentMockUser.uid, text, timestamp: Date.now() });
    return { success: true };
  },
  listenToMessages: (id: string, callback: (msgs: any[]) => void, errorCallback?: (error: any) => void) => {
    callback([...mockMessages]);
    const interval = setInterval(() => callback([...mockMessages]), 1000);
    return () => clearInterval(interval);
  }
};

export const storageService = {
  uploadKYC: async (file: File, path: string) => {
    await delay(1000);
    return { url: "https://via.placeholder.com/150", error: null };
  }
};

export const kycService = {
  submitCustomerKYC: async (uid: string, data: any) => {
    await delay(500);
    return { error: null };
  },
  registerDriverBasicInfo: async (uid: string, data: any) => {
    await delay(500);
    return { success: true };
  },
  submitDriverKYC: async (uid: string, data: any) => {
    await delay(500);
    if (currentMockUser) currentMockUser.isDriver = true;
    return { error: null };
  }
};
