
import React from 'react';
import { Trip, TripStatus, VehicleType } from './types';

export const KERALA_LOCATIONS = [
  "Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam", 
  "Palakkad", "Alappuzha", "Kannur", "Kottayam", "Malappuram", 
  "Manjeri", "Thalassery", "Ponnani", "Vatakara", "Kanhangad",
  "Payyanur", "Koyilandy", "Parappanangadi", "Kalamassery", 
  "Punalur", "Neyyattinkara", "Technopark, TVM", "Infopark, Kochi"
];

export const MOCK_TRIPS: Trip[] = [
  {
    id: 't1',
    ownerId: 'u2',
    ownerName: 'Rahul Nair',
    ownerAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rahul',
    ownerRating: 4.8,
    ownerPhone: '+91 9999999999',
    from: 'Technopark, TVM',
    to: 'Kollam Bypass',
    date: 'Today',
    time: '18:30',
    vehicleType: VehicleType.CAR,
    pricePerSeat: 180,
    availableSeats: 2,
    status: TripStatus.OPEN,
    description: 'Daily commute. AC available. Good music.',
    requests: []
  },
  {
    id: 't2',
    ownerId: 'u3',
    ownerName: 'Fatima S',
    ownerAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Fatima',
    ownerRating: 4.9,
    ownerPhone: '+91 8888888888',
    from: 'Infopark, Kochi',
    to: 'Aluva Metro',
    date: 'Today',
    time: '17:15',
    vehicleType: VehicleType.BIKE,
    pricePerSeat: 60,
    availableSeats: 1,
    status: TripStatus.OPEN,
    description: 'Quick ride to metro. Helmet available.',
    requests: []
  }
];

export const Icons = {
  Logo: ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
       <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
       <circle cx="7" cy="17" r="2" />
       <circle cx="17" cy="17" r="2" />
    </svg>
  ),
  Home: () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Search: () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  Plus: () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  User: ({ className }: { className?: string }) => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className={className}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Car: ({ className }: { className?: string }) => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className={className}><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>,
  Shield: ({ className }: { className?: string }) => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className={className}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Check: ({ className }: { className?: string }) => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className={className}><polyline points="20 6 9 17 4 12"/></svg>,
  Send: ({ className }: { className?: string }) => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className={className}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Target: ({ className }: { className?: string }) => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className={className}><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>,
  Leaf: ({ className }: { className?: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>,
  Wallet: ({ className }: { className?: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>,
};
