
import React, { useState } from 'react';
import { Trip, User, Booking } from '../types';
import { Icons } from '../constants';
import { bookingService } from '../services/firebaseService';

interface Props {
  trip: Trip;
  user: User;
  onBack: () => void;
  onPaymentSuccess: (booking: Booking, method: string) => void;
}

declare const Razorpay: any;

export const PaymentScreen: React.FC<Props> = ({ trip, user, onBack, onPaymentSuccess }) => {
  const [method, setMethod] = useState<'RAZORPAY' | 'DIRECT'>('RAZORPAY');
  const [loading, setLoading] = useState(false);
  const bookingFee = 5;
  const total = trip.pricePerSeat + bookingFee;

  const handleRazorpay = () => {
    return new Promise((resolve) => {
      const options = {
        key: "rzp_test_mock", // Replace with real key if needed
        amount: total * 100,
        currency: "INR",
        name: "TripIn Kerala",
        description: `Booking ride to ${trip.to}`,
        handler: function (response: any) {
          resolve(true);
        },
        prefill: {
          name: user.name,
          email: user.email,
          contact: user.phone
        },
        theme: {
          color: "#16A34A"
        }
      };
      
      try {
        const rzp = new Razorpay(options);
        rzp.open();
      } catch (e) {
        console.error("Razorpay error, using mock success for demo:", e);
        resolve(true);
      }
    });
  };

  const handleBooking = async () => {
    setLoading(true);

    if (method === 'RAZORPAY') {
        const paid = await handleRazorpay();
        if (!paid) {
            setLoading(false);
            return;
        }
    }

    const { data: booking, error } = await bookingService.createBooking({
        userId: user.id,
        driverId: trip.ownerId,
        tripId: trip.id,
        amount: trip.pricePerSeat,
        ownerName: trip.ownerName,
        ownerAvatar: trip.ownerAvatar,
        ownerPhone: trip.ownerPhone,
        from: trip.from,
        to: trip.to,
        date: trip.date
    }, method);
    
    if (booking) {
        onPaymentSuccess(booking as Booking, method);
    } else {
        alert("Booking failed. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="p-8 space-y-8 animate-in slide-in-from-right-8 pb-32">
      <div className="flex items-center gap-6">
        <button onClick={onBack} className="bg-white p-3 rounded-2xl border border-subtle shadow-sm active:scale-95">←</button>
        <h2 className="text-3xl font-black italic uppercase text-main tracking-tighter">Checkout</h2>
      </div>

      <div className="bg-white p-8 rounded-[48px] border border-subtle shadow-2xl space-y-8">
        <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase text-muted tracking-widest">Trip Summary</h3>
            <div className="space-y-4 bg-surface-alt p-6 rounded-[32px] border border-subtle">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-[10px] font-black uppercase text-muted mb-1">Route</p>
                        <p className="font-black text-sm text-main leading-tight">{trip.from} → {trip.to}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase text-muted mb-1">Vehicle</p>
                        <p className="font-black text-sm text-main uppercase">{trip.vehicleType}</p>
                    </div>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-subtle/50">
                    <p className="text-xs font-bold text-muted uppercase tracking-widest">Seat Price</p>
                    <p className="font-black text-main italic">₹{trip.pricePerSeat}</p>
                </div>
                <div className="flex justify-between items-center">
                    <p className="text-xs font-bold text-muted uppercase tracking-widest">Booking Fee</p>
                    <p className="font-black text-main italic">₹{bookingFee}</p>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-subtle mt-2">
                    <h2 className="text-xl font-black italic uppercase text-main">Total</h2>
                    <h2 className="text-3xl font-black italic text-[#16A34A]">₹{total}</h2>
                </div>
            </div>
        </div>

        <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase text-muted tracking-widest">Choose Payment Method</h3>

            <button onClick={() => setMethod('RAZORPAY')} className={`w-full p-6 rounded-[32px] border-2 transition-all flex items-center justify-between ${method === 'RAZORPAY' ? 'border-blue-500 bg-blue-50' : 'border-subtle bg-surface-alt'}`}>
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${method === 'RAZORPAY' ? 'bg-blue-500 text-white' : 'bg-white text-muted border border-subtle'}`}>
                        <Icons.Logo className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                        <p className="text-xs font-black uppercase text-main">Razorpay / UPI</p>
                        <p className="text-[9px] font-bold text-muted uppercase tracking-widest">Cards, UPI, GPay</p>
                    </div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${method === 'RAZORPAY' ? 'border-blue-500 bg-blue-500' : 'border-subtle'}`}>
                   {method === 'RAZORPAY' && <Icons.Check className="w-4 h-4 text-white" />}
                </div>
            </button>

            <button onClick={() => setMethod('DIRECT')} className={`w-full p-6 rounded-[32px] border-2 transition-all flex items-center justify-between ${method === 'DIRECT' ? 'border-[#EA580C] bg-orange-50' : 'border-subtle bg-surface-alt'}`}>
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${method === 'DIRECT' ? 'bg-[#EA580C] text-white' : 'bg-white text-muted border border-subtle'}`}>
                        <Icons.Car className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                        <p className="text-xs font-black uppercase text-main">Pay After Ride</p>
                        <p className="text-[9px] font-bold text-muted uppercase tracking-widest">Pay cash/UPI to driver</p>
                    </div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${method === 'DIRECT' ? 'border-[#EA580C] bg-[#EA580C]' : 'border-subtle'}`}>
                   {method === 'DIRECT' && <Icons.Check className="w-4 h-4 text-white" />}
                </div>
            </button>
        </div>

        <div className="pt-4">
            <button 
                onClick={handleBooking} 
                disabled={loading} 
                className="w-full bg-[#16A34A] text-white py-6 rounded-[32px] font-black text-xs uppercase shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
                {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                    'Confirm Booking'
                )}
            </button>
            <p className="text-[9px] font-bold text-muted text-center mt-4 uppercase tracking-widest flex items-center justify-center gap-2">
                <Icons.Shield className="w-3 h-3" /> Secure TripIn Booking
            </p>
        </div>
      </div>
    </div>
  );
};