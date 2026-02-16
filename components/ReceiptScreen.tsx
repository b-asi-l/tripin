import React, { useState } from 'react';
import { Booking } from '../types';
import { Icons } from '../constants';
import { bookingService } from '../services/firebaseService';

interface Props {
  booking: Booking;
  onHome: () => void;
  onChat: () => void;
  onTrack: () => void;
  onCancelSuccess: () => void;
}

export const ReceiptScreen: React.FC<Props> = ({ booking, onHome, onChat, onTrack, onCancelSuccess }) => {
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    if (!window.confirm("Are you sure you want to cancel this ride? The amount will be refunded to your wallet.")) return;

    setCancelling(true);
    // Refund amount (seat price + booking fee)
    const refundAmount = booking.amount + 5;
    
    const { success, error } = await bookingService.cancelBooking(booking.id, booking.tripId, booking.userId, refundAmount);
    
    setCancelling(false);
    
    if (success) {
        alert("Booking Cancelled. ₹" + refundAmount + " has been refunded to your wallet.");
        onCancelSuccess();
    } else {
        alert("Failed to cancel booking: " + (error?.message || "Unknown error"));
    }
  };

  const isCancelled = booking.status === 'CANCELLED';

  return (
    <div className="p-8 h-full flex flex-col items-center justify-center animate-in zoom-in-95 duration-500">
      <div className={`bg-surface p-8 rounded-[48px] border border-subtle card-shadow w-full text-center space-y-6 relative overflow-hidden ${isCancelled ? 'opacity-80' : ''}`}>
        <div className={`absolute top-0 left-0 w-full h-2 bg-gradient-to-r ${isCancelled ? 'from-rose-400 to-rose-600' : 'from-emerald-400 to-emerald-600'}`}></div>
        
        <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-4 ${isCancelled ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600 animate-bounce'}`}>
            {isCancelled ? (
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            ) : (
                <Icons.Check className="w-10 h-10" />
            )}
        </div>
        
        <h2 className={`text-2xl font-black italic uppercase tracking-tighter ${isCancelled ? 'text-rose-500' : 'text-main'}`}>
            {isCancelled ? 'Ride Cancelled' : 'Ride Confirmed!'}
        </h2>
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
                <span className="text-main font-black uppercase">{isCancelled ? 'Refunded' : 'Paid'}</span>
                <span className={`font-black ${isCancelled ? 'text-muted line-through' : 'text-[var(--color-primary)]'}`}>₹{booking.amount + 5}</span>
            </div>
        </div>

        {!isCancelled && (
            <div className="space-y-3">
                <button onClick={onTrack} className="w-full bg-emerald-500 text-white py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                    <Icons.Car className="w-4 h-4" /> Track Live Ride
                </button>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={onHome} className="bg-surface-alt text-main py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-subtle">Home</button>
                    <button onClick={onChat} className="bg-surface-alt text-main py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-subtle">Chat</button>
                </div>
                <button 
                    onClick={handleCancel} 
                    disabled={cancelling}
                    className="w-full text-rose-500 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 transition-all disabled:opacity-50"
                >
                    {cancelling ? 'Cancelling...' : 'Cancel Ride'}
                </button>
            </div>
        )}

        {isCancelled && (
             <button onClick={onHome} className="w-full bg-surface-alt text-main py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-subtle shadow-lg">Back to Home</button>
        )}
      </div>
    </div>
  );
};