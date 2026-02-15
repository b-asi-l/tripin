import React, { useState } from 'react';
import { Trip, User, Booking } from '../types';
import { Icons } from '../constants';

interface Props {
  trip: Trip;
  user: User;
  onBack: () => void;
  onPaymentSuccess: (booking: Booking, method: string) => void;
}

export const PaymentScreen: React.FC<Props> = ({ trip, user, onBack, onPaymentSuccess }) => {
  const [processing, setProcessing] = useState(false);
  const [waitingForPayment, setWaitingForPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'WALLET' | 'RAZORPAY'>('WALLET');

  const RAZORPAY_LINK = "https://razorpay.me/@basilmathew4596";
  const totalAmount = trip.pricePerSeat + 5;

  const handlePay = () => {
    setProcessing(true);
    
    if (paymentMethod === 'RAZORPAY') {
        // Direct to Payment Page logic
        window.open(RAZORPAY_LINK, '_blank');
        setWaitingForPayment(true);
        setProcessing(false);
        return;
    }

    // Wallet simulation
    setTimeout(() => {
      confirmBooking();
    }, 2000);
  };

  const confirmBooking = () => {
      const mockBooking: Booking = {
        id: 'bk_' + Date.now(),
        tripId: trip.id || 'temp',
        userId: user.id,
        driverId: trip.ownerId, // Added for Firestore persistence
        ownerName: trip.ownerName,
        ownerAvatar: trip.ownerAvatar,
        amount: trip.pricePerSeat,
        status: 'CONFIRMED',
        date: trip.date,
        from: trip.from,
        to: trip.to
      };
      onPaymentSuccess(mockBooking, paymentMethod);
  };

  if (waitingForPayment) {
    return (
      <div className="p-8 space-y-8 animate-in zoom-in-95 h-full flex flex-col justify-center items-center">
         <div className="bg-surface p-8 rounded-[40px] border border-subtle card-shadow space-y-6 w-full text-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full mx-auto flex items-center justify-center text-[#3395ff] animate-pulse">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            </div>
            <h2 className="text-xl font-black italic uppercase text-main">Complete Payment</h2>
            <p className="text-muted text-sm font-medium">We've opened the Razorpay secure payment page in a new tab. Please complete the transaction there.</p>
            
            <div className="space-y-3 pt-4">
                <button 
                    onClick={confirmBooking}
                    className="w-full bg-[#3395ff] text-white py-5 rounded-[24px] font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
                >
                    I Have Paid
                </button>
                <button 
                    onClick={() => setWaitingForPayment(false)}
                    className="w-full bg-surface-alt text-muted py-5 rounded-[24px] font-black text-xs uppercase tracking-widest border border-subtle active:scale-95 transition-all"
                >
                    Cancel / Retry
                </button>
            </div>
         </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-in slide-in-from-right-8 h-full flex flex-col">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="bg-surface p-3 rounded-xl border border-subtle text-main hover:bg-subtle transition-all">
          ←
        </button>
        <h2 className="text-xl font-black italic uppercase text-main">Checkout</h2>
      </div>

      <div className="bg-surface p-8 rounded-[40px] border border-subtle card-shadow space-y-6 flex-1 flex flex-col">
        <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase text-muted tracking-widest">Trip Summary</h3>
            <div className="flex justify-between items-center border-b border-subtle pb-4">
                <span className="text-sm font-bold text-main">{trip.from.split(',')[0]} → {trip.to.split(',')[0]}</span>
                <span className="text-sm font-bold text-main">₹{trip.pricePerSeat}</span>
            </div>
            <div className="flex justify-between items-center border-b border-subtle pb-4">
                <span className="text-sm font-bold text-main">Booking Fee</span>
                <span className="text-sm font-bold text-main">₹5</span>
            </div>
             <div className="flex justify-between items-center pt-2">
                <span className="text-lg font-black text-main uppercase">Total</span>
                <span className="text-2xl font-black text-[var(--color-primary)]">₹{totalAmount}</span>
            </div>
        </div>

        <div className="mt-8 space-y-4">
             <h3 className="text-[10px] font-black uppercase text-muted tracking-widest">Payment Method</h3>
             
             {/* Wallet Option */}
             <div 
                onClick={() => setPaymentMethod('WALLET')}
                className={`bg-surface-alt p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${paymentMethod === 'WALLET' ? 'border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]' : 'border-subtle hover:border-muted'}`}
             >
                 <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center text-[var(--color-primary)] font-black text-xs">W</div>
                     <span className="text-sm font-bold text-main">TripIn Wallet (₹{user.balance})</span>
                 </div>
                 <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${paymentMethod === 'WALLET' ? 'border-[var(--color-primary)]' : 'border-muted'}`}>
                    {paymentMethod === 'WALLET' && <div className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />}
                 </div>
             </div>

             {/* Razorpay Option */}
             <div 
                onClick={() => setPaymentMethod('RAZORPAY')}
                className={`bg-surface-alt p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${paymentMethod === 'RAZORPAY' ? 'border-[#3395ff] ring-1 ring-[#3395ff]' : 'border-subtle hover:border-muted'}`}
             >
                 <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-[#3395ff]/20 flex items-center justify-center text-[#3395ff] font-black text-xs">R</div>
                     <span className="text-sm font-bold text-main">Razorpay / UPI</span>
                 </div>
                 <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${paymentMethod === 'RAZORPAY' ? 'border-[#3395ff]' : 'border-muted'}`}>
                    {paymentMethod === 'RAZORPAY' && <div className="w-2 h-2 rounded-full bg-[#3395ff]" />}
                 </div>
             </div>
        </div>

        <div className="mt-auto">
            <button 
                onClick={handlePay}
                disabled={processing || (paymentMethod === 'WALLET' && user.balance < totalAmount)}
                className={`w-full text-white py-6 rounded-[30px] font-black text-xs uppercase tracking-widest shadow-2xl transition-all active:scale-95 disabled:opacity-50 disabled:grayscale ${paymentMethod === 'RAZORPAY' ? 'bg-[#3395ff] shadow-blue-500/20' : 'bg-[var(--color-primary)]'}`}
            >
                {processing ? 'Processing...' : (paymentMethod === 'RAZORPAY' ? `Pay ₹${totalAmount} via Razorpay` : `Pay ₹${totalAmount}`)}
            </button>
            {paymentMethod === 'WALLET' && user.balance < totalAmount && (
                <p className="text-rose-500 text-[9px] font-bold text-center mt-4 uppercase tracking-wider">Insufficient Balance</p>
            )}
             {paymentMethod === 'RAZORPAY' && (
                <p className="text-muted text-[9px] font-bold text-center mt-4 uppercase tracking-wider">Secure Payment via Razorpay Link</p>
            )}
        </div>
      </div>
    </div>
  );
};