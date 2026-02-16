
export type ViewState = 
| 'LOGIN' 
| 'PROFILE_SETUP'
| 'HOME' 
| 'SEARCH' 
| 'POST' 
| 'TRIP_DETAIL' 
| 'PROFILE' 
| 'PAYMENT' 
| 'RECEIPT' 
| 'CHAT'
| 'CUSTOMER_KYC'
| 'DRIVER_KYC'
| 'ADMIN_PANEL'
| 'LIVE_TRACKING'
| 'TOP_UP'
| 'EARNINGS'
| 'MY_REQUESTS';

export enum VehicleType {
  CAR = 'CAR',
  BIKE = 'BIKE'
}

export enum TripStatus {
  OPEN = 'OPEN',
  FULL = 'FULL',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  tripsCount: number;
  isDriver: boolean;
  isOnboarded: boolean;
  isVerified: boolean;
  driverVerificationStatus: 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  co2Saved: number;
  moneySaved: number;
  balance: number;
  earnings: number; 
  bankDetails?: {
    accountName: string;
    accountNumber: string;
    ifsc: string;
    bankName: string;
  };
  kycData?: {
    aadhaar: string;
    docUrl: string;
  };
  phone?: string;
  address?: string;
  sex?: 'Male' | 'Female' | 'Other';
  bloodGroup?: string;
  emergencyContact?: string;
}

export interface Trip {
  id?: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar: string;
  ownerRating: number;
  ownerPhone: string;
  from: string;
  to: string;
  date: string;
  time: string;
  vehicleType: VehicleType;
  pricePerSeat: number;
  availableSeats: number;
  status: TripStatus;
  description: string;
  requests: any[];
}

export interface TripRequest {
  id: string;
  tripId: string;
  passengerId: string;
  passengerName: string;
  passengerAvatar: string;
  driverId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: number;
  tripFrom: string;
  tripTo: string;
}

export interface Booking {
  id: string;
  tripId: string;
  userId: string;
  driverId: string; 
  ownerName: string;
  ownerAvatar: string;
  amount: number;
  status: 'CONFIRMED' | 'CANCELLED';
  date: string;
  from: string;
  to: string;
}

export interface LiveLocation {
  lat: number;
  lng: number;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  isMe?: boolean; // Optional in some contexts, but kept for compatibility
}

export interface DriverTransaction {
  id: string;
  driverId: string;
  amount: number;
  type: 'RIDE_EARNING' | 'WITHDRAWAL';
  description: string;
  status: 'COMPLETED' | 'PROCESSING';
  createdAt: number;
}
