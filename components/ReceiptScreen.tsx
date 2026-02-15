
import React from 'react';
import { Booking } from '../types';
import { Icons } from '../constants';

interface Props {
  booking: Booking;
  onHome: () => void;
  onChat: () => void;
  onTrack: () => void;
}

export const ReceiptScreen: React.FC<Props> = ({ booking, onHome, onChat, onTrack }) => {
  return (
    <div className="p-8 h-full flex flex-col items-center justify-center animate-in zoom-in-95 duration-500">
      <div className="bg-surface p-8 rounded-[48px] border border-subtle card-shadow w-full text-center space-y-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-emerald-600"></div>
        
        <div className="w-20 h-20 bg-emerald-100 rounded-full mx-auto flex items-center justify-center mb-4 text-emerald-600 animate-bounce">
            <Icons.Check className="w-10 h-10" />
        </div>
        
        <h2 className="text-2xl font-black italic uppercase text-main tracking-tighter">Ride Confirmed!</h2>
        <p className="text-muted text-xs font-medium">Booking ID: {booking.id.toUpperCase()}</p>
        
        <div className="border-t border-b border-dashed border-subtle py-6 space-y-4">
            <div className="flex justify-between text-xs">
                <span className="text-muted font-bold uppercase">Driver</span>
                <span className="text-main font-black uppercase">{booking.ownerName}</span>
            </div>
            <div className="flex justify-between text-xs">
                <span className="text-muted font-bold uppercase">From</span>
                <span className="text-main font-black">{booking.from.split(',')[0]}</span>
            </div>
            <div className="flex justify-between text-xs">
                <span className="text-muted font-bold uppercase">To</span>
                <span className="text-main font-black">{booking.to.split(',')[0]}</span>
            </div>
             <div className="flex justify-between text-lg pt-2">
                <span className="text-main font-black uppercase">Paid</span>
                <span className="text-[var(--color-primary)] font-black">₹{booking.amount + 5}</span>
            </div>
        </div>

        <div className="space-y-3">
            <button onClick={onTrack} className="w-full bg-emerald-500 text-white py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                <Icons.Car className="w-4 h-4" /> Track Live Ride
            </button>
            <div className="grid grid-cols-2 gap-3">
                <button onClick={onHome} className="bg-surface-alt text-main py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-subtle">Home</button>
                <button onClick={onChat} className="bg-surface-alt text-main py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-subtle">Chat</button>
            </div>
        </div>
      </div>
    </div>
  );
};
