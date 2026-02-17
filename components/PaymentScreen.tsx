
import React, { useState, useEffect } from 'react';
import { Trip, User, Booking } from '../types';
import { Icons } from '../constants';

interface Props {
  trip: Trip;
  user: User;
  onBack: () => void;
  onPaymentSuccess: (booking: Booking, method: string) => void;
}

// Global Razorpay declaration for TypeScript
declare global {
  interface Window {
    Razorpay: any;
  }
}

export const PaymentScreen: React.FC<Props> = ({ trip, user, onBack, onPaymentSuccess }) => {
  const [processing, setProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'IDLE' | 'PENDING' | 'VERIFYING' | 'FAILED'>('IDLE');

  const totalAmount = trip.pricePerSeat + 5;
  // Live/Test Key provided by user
  const RAZORPAY_KEY = "rzp_test_SH8RsgQgXo9DTM"; 

  // Ensure Razorpay script is loaded
  useEffect(() => {
    if (!window.Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const handleWalletPay = () => {
    if (user.balance < totalAmount) {
      alert("Insufficient wallet balance. Please Top Up.");
      return;
    }
    setProcessing(true);
    setPaymentStatus('VERIFYING');
    
    // Wallet simulation
    setTimeout(() => {
      confirmBooking('WALLET');
    }, 1500);
  };

  const handleRazorpayPay = () => {
    if (!RAZORPAY_KEY) {
        alert("Payment configuration missing. Please check API Key.");
        return;
    }

    if (typeof window.Razorpay === 'undefined') {
        alert("Payment gateway not loaded. Check your internet connection.");
        return;
    }

    setProcessing(true);
    setPaymentStatus('PENDING');

    const options = {
      key: RAZORPAY_KEY,
      amount: totalAmount * 100, // Amount in paise
      currency: "INR",
      name: "TripIn Kerala",
      description: `Ride: ${trip.from.split(',')[0]} to ${trip.to.split(',')[0]}`,
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=TripIn",
      
      // Success Handler
      handler: function (response: any) {
        console.log("Razorpay Success:", response);
        // Explicitly check for payment ID to confirm success
        if (response.razorpay_payment_id) {
            setPaymentStatus('VERIFYING');
            // Slight delay for UX before transitioning
            setTimeout(() => {
                confirmBooking('RAZORPAY');
            }, 1000);
        } else {
            handleFailure({ error: { description: "Payment verification failed" } });
        }
      },
      
      prefill: {
        name: user.name,
        email: user.email || "support@tripin.dev",
        contact: user.phone || ""
      },
      notes: {
        trip_id: trip.id,
        user_id: user.id
      },
      theme: {
        color: "#16A34A"
      },
      // Modal Close Handler
      modal: {
        ondismiss: function () {
          setPaymentStatus((prev) => {
              // Only trigger failure if we aren't already verifying a success
              if (prev !== 'VERIFYING') {
                  setProcessing(false);
                  alert("Payment cancelled. Ride booking aborted.");
                  return 'FAILED';
              }
              return prev;
          });
        }
      }
    };

    try {
      const rzp = new window.Razorpay(options);
      
      // Failure Handler
      rzp.on('payment.failed', function (response: any) {
          handleFailure(response);
      });
      
      rzp.open();
    } catch (e) {
      console.error("Razorpay init error:", e);
      setProcessing(false);
      setPaymentStatus('IDLE');
      alert("Error initializing payment gateway.");
    }
  };

  const handleFailure = (response: any) => {
      console.error("Payment Failed:", response);
      setPaymentStatus('FAILED');
      setProcessing(false);
      // Automatic Cancellation Alert
      alert(`Ride Booking Cancelled: ${response.error?.description || "Payment failed"}`);
  };

  const confirmBooking = (method: string) => {
      const confirmedBooking: Booking = {
        id: 'bk_' + Date.now(),
        tripId: trip.id || 'temp',
        userId: user.id,
        driverId: trip.ownerId,
        ownerName: trip.ownerName,
        ownerAvatar: trip.ownerAvatar,
        amount: trip.pricePerSeat,
        status: 'CONFIRMED',
        date: trip.date,
        from: trip.from,
        to: trip.to
      };
      onPaymentSuccess(confirmedBooking, method);
  };

  if (paymentStatus === 'VERIFYING') {
      return (
        <div className="p-8 space-y-8 animate-in zoom-in-95 h-full flex flex-col justify-center items-center">
            <div className="bg-surface p-10 rounded-[48px] border border-subtle card-shadow space-y-6 w-full text-center">
                <div className="w-20 h-20 border-4 border-emerald-100 border-t-emerald-600 rounded-full mx-auto animate-spin" />
                <h2 className="text-xl font-black italic uppercase text-main">Securing Ride</h2>
                <p className="text-muted text-[10px] font-bold uppercase tracking-widest">Payment verified. Confirming with driver...</p>
            </div>
        </div>
      );
  }

  return (
    <div className="p-8 space-y-8 animate-in slide-in-from-right-8 h-full flex flex-col">
      <div className="flex items-center gap-4">
        <button onClick={onBack} disabled={processing} className="bg-surface p-3 rounded-xl border border-subtle text-main hover:bg-subtle transition-all disabled:opacity-50">
          ←
        </button>
        <h2 className="text-xl font-black italic uppercase text-main">Checkout</h2>
      </div>

      <div className="bg-surface p-8 rounded-[40px] border border-subtle card-shadow space-y-6 flex-1 flex flex-col">
        <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase text-muted tracking-widest">Trip Summary</h3>
            <div className="flex justify-between items-center border-b border-subtle pb-4">
                <div className="space-y-1">
                   <p className="text-sm font-bold text-main">{trip.from.split(',')[0]} → {trip.to.split(',')[0]}</p>
                   <p className="text-[10px] text-muted font-bold uppercase tracking-tighter">{trip.ownerName}'s Pool</p>
                </div>
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

        <div className="mt-8 space-y-4 flex-1">
             <h3 className="text-[10px] font-black uppercase text-muted tracking-widest">Choose Payment Method</h3>
             
             {/* Wallet Option */}
             <button 
                onClick={handleWalletPay}
                disabled={processing || user.balance < totalAmount}
                className={`w-full bg-surface-alt p-6 rounded-[28px] border-2 flex items-center justify-between transition-all active:scale-95 ${user.balance >= totalAmount ? 'border-subtle hover:border-[var(--color-primary)]' : 'opacity-50 grayscale'}`}
             >
                 <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center shadow-lg">
                        <Icons.Wallet className="w-5 h-5" />
                     </div>
                     <div className="text-left">
                         <p className="text-xs font-black uppercase text-main">TripIn Wallet</p>
                         <p className="text-[9px] font-bold text-muted uppercase tracking-tight">Available: ₹{user.balance}</p>
                     </div>
                 </div>
                 <div className="text-[var(--color-primary)]">
                    <Icons.Check className="w-5 h-5 opacity-40" />
                 </div>
             </button>

             {/* Razorpay Option */}
             <button 
                onClick={handleRazorpayPay}
                disabled={processing}
                className="w-full bg-surface-alt p-6 rounded-[28px] border-2 border-subtle hover:border-[#3395ff] transition-all active:scale-95 flex items-center justify-between"
             >
                 <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-full bg-[#3395ff] text-white flex items-center justify-center shadow-lg">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                     </div>
                     <div className="text-left">
                         <p className="text-xs font-black uppercase text-main">Razorpay / UPI</p>
                         <p className="text-[9px] font-bold text-muted uppercase tracking-tight">Cards, UPI, Netbanking</p>
                     </div>
                 </div>
                 <div className="text-[#3395ff]">
                    {processing && paymentStatus === 'PENDING' ? (
                       <div className="w-5 h-5 border-2 border-[#3395ff] border-t-transparent rounded-full animate-spin" />
                    ) : (
                       <Icons.Check className="w-5 h-5 opacity-40" />
                    )}
                 </div>
             </button>
        </div>

        <div className="mt-auto space-y-4">
            <div className="flex items-center justify-center gap-2 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                <Icons.Shield className="w-4 h-4 text-emerald-600" />
                <p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest leading-none">Safe & Secure Payment</p>
            </div>
        </div>
      </div>
    </div>
  );
};
