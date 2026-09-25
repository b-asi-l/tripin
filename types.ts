
export type ViewState = 
| 'LOGIN' 
| 'EMAIL_VERIFICATION'
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
| 'EARNINGS'
| 'TOPUP'
| 'ABOUT'
| 'CONTACT_US'
| 'TERMS'
| 'REFUND_POLICY'
| 'UBER';

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

export interface DriverTransaction {
  id: string;
  driverId: string;
  amount: number;
  type: 'RIDE_EARNING' | 'WITHDRAWAL';
  description: string;
  status: 'COMPLETED' | 'PROCESSING' | 'FAILED';
  createdAt: number;
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
  fuelSaved: number;
  walletBalance: number;
  earnings: number;
  level: number;
  phone?: string;
  address?: string;
  email?: string;
  sex?: 'Male' | 'Female' | 'Other';
  bloodGroup?: string;
  emergencyContact?: string;
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

export interface Booking {
  id: string;
  tripId: string;
  userId: string;
  driverId: string; 
  ownerName: string;
  ownerAvatar: string;
  ownerPhone: string;
  amount: number;
  status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  paymentMethod: 'RAZORPAY' | 'DIRECT';
  date: string;
  from: string;
  to: string;
  createdAt?: number;
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
  isMe?: boolean;
}
