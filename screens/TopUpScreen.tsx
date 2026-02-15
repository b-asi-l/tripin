import React, { useState } from 'react';
import { User } from '../types';
import { userService } from '../services/firebaseService';

interface Props {
  user: User;
  onBack: () => void;
  onSuccess: () => void;
}

export const TopUpScreen: React.FC<Props> = ({ user, onBack, onSuccess }) => {
  const [amount, setAmount] = useState<number>(500);
  const [processing, setProcessing] = useState(false);
  const [waitingForPayment, setWaitingForPayment] = useState(false);

  const RAZORPAY_LINK = "https://razorpay.me/@basilmathew4596";

  const handleTopUp = () => {
    setProcessing(true);
    // Standard Razorpay Link flow
    window.open(RAZORPAY_LINK, '_blank');
    setWaitingForPayment(true);
    setProcessing(false);
  };

  const confirmTopUp = async () => {
    setProcessing(true);
    const { error } = await userService.topUpBalance(user.id, amount);
    if (error) {
      alert("Top up failed: " + (error.message || "Unknown error"));
    } else {
      onSuccess();
    }
    setProcessing(false);
  };

  if (waitingForPayment) {
    return (
      <div className="p-8 space-y-8 animate-in zoom-in-95 h-full flex flex-col justify-center items-center">
         <div className="bg-surface p-8 rounded-[40px] border border-subtle card-shadow space-y-6 w-full text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full mx-auto flex items-center justify-center text-emerald-600 animate-pulse">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="m17 5-5-3-5 3"/><path d="m17 19-5 3-5-3"/><path d="M2 12h20"/></svg>
            </div>
            <h2 className="text-xl font-black italic uppercase text-main">Complete Payment</h2>
            <p className="text-muted text-sm font-medium">Please pay ₹{amount} via the Razorpay window that opened. Click below once done.</p>
            
            <div className="space-y-3 pt-4">
                <button 
                    onClick={confirmTopUp}
                    disabled={processing}
                    className="w-full bg-[var(--color-primary)] text-white py-5 rounded-[24px] font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95 transition-all"
                >
                    {processing ? 'Updating Balance...' : 'I Have Paid'}
                </button>
                <button 
                    onClick={() => setWaitingForPayment(false)}
                    className="w-full bg-surface-alt text-muted py-5 rounded-[24px] font-black text-xs uppercase tracking-widest border border-subtle active:scale-95 transition-all"
                >
                    Cancel / Change Amount
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
        <h2 className="text-xl font-black italic uppercase text-main">Top Up Wallet</h2>
      </div>

      <div className="bg-surface p-8 rounded-[40px] border border-subtle card-shadow space-y-8 flex-1">
        <div className="space-y-4">
            <label className="text-[10px] font-black uppercase text-muted ml-4 tracking-widest">Select Amount</label>
            <div className="grid grid-cols-3 gap-3">
                {[100, 200, 500, 1000, 2000, 5000].map(val => (
                    <button 
                        key={val}
                        onClick={() => setAmount(val)}
                        className={`py-4 rounded-2xl font-black text-xs border transition-all ${amount === val ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-lg shadow-emerald-500/20' : 'bg-surface-alt text-main border-subtle hover:border-[var(--color-primary)]/50'}`}
                    >
                        ₹{val}
                    </button>
                ))}
            </div>
        </div>

        <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-muted ml-4 tracking-widest">Custom Amount</label>
            <input 
                type="number"
                value={amount}
                onChange={e => setAmount(parseInt(e.target.value) || 0)}
                className="w-full bg-surface-alt p-5 rounded-[24px] font-black text-2xl text-center text-main border border-subtle focus:border-[var(--color-primary)] outline-none"
            />
        </div>

        <div className="pt-8">
            <button 
                onClick={handleTopUp}
                className="w-full bg-[#3395ff] text-white py-6 rounded-[30px] font-black text-xs uppercase tracking-widest shadow-2xl shadow-blue-500/20 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
                Add ₹{amount} via Razorpay
            </button>
            <p className="text-muted text-[9px] font-bold text-center mt-4 uppercase tracking-wider">Secure UPI / Card Payments</p>
        </div>
      </div>
    </div>
  );
};
