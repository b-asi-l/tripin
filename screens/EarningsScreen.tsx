
import React, { useEffect, useState } from 'react';
import { User, DriverTransaction } from '../types';
import { driverService } from '../services/firebaseService';
import { Icons } from '../constants';

interface Props {
  user: User;
  onBack: () => void;
  onSuccess: () => void;
}

export const EarningsScreen: React.FC<Props> = ({ user, onBack, onSuccess }) => {
  const [history, setHistory] = useState<DriverTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  const [showBankForm, setShowBankForm] = useState(false);
  
  // Initialize with persisted bank details if available
  const [bankDetails, setBankDetails] = useState({
    accountName: user.bankDetails?.accountName || '',
    accountNumber: user.bankDetails?.accountNumber || '',
    ifsc: user.bankDetails?.ifsc || '',
    bankName: user.bankDetails?.bankName || ''
  });

  const hasBankDetails = !!user.bankDetails?.accountNumber;

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      // Recalculate earnings locally based on booking history to ensure accuracy
      // This fixes the issue where riders cannot update driver earnings directly
      await driverService.recalculateEarnings(user.id);
      
      const { data } = await driverService.getEarningsHistory(user.id);
      if (data) setHistory(data);
      
      setLoading(false);
      onSuccess(); // Triggers a profile refresh in the parent to update the displayed earnings
    };
    fetchHistory();
  }, [user.id]);

  const handleSaveBankDetails = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!bankDetails.accountName || !bankDetails.accountNumber || !bankDetails.ifsc || !bankDetails.bankName) {
        alert("All bank details are mandatory.");
        return;
      }
      
      setSavingBank(true);
      const { success, error } = await driverService.saveBankDetails(user.id, bankDetails);
      setSavingBank(false);
      
      if (success) {
          setShowBankForm(false);
          onSuccess(); // Refresh user profile to show saved details
      } else {
          alert("Failed to save bank details.");
      }
  };

  const handleRedeemClick = async () => {
    if (!user.earnings || user.earnings <= 0) return;
    
    if (!hasBankDetails) {
        setShowBankForm(true);
        alert("Please save your bank details first.");
        return;
    }

    if (!window.confirm(`Are you sure you want to withdraw ₹${user.earnings.toFixed(2)} to account ${user.bankDetails?.accountNumber}?`)) {
        return;
    }
    
    setRedeeming(true);
    // Use stored bank details for redemption
    const { success, error } = await driverService.redeemEarnings(user.id, user.earnings, bankDetails);
    setRedeeming(false);

    if (success) {
      setRedeemSuccess(true);
      setTimeout(() => {
        onSuccess(); // Triggers a profile refresh in parent
      }, 3000);
    } else {
      alert("Redemption failed: " + error);
    }
  };

  if (redeemSuccess) {
    return (
      <div className="p-8 h-full flex flex-col items-center justify-center animate-in zoom-in-95">
        <div className="bg-surface p-8 rounded-[48px] border border-subtle card-shadow text-center space-y-6 w-full">
            <div className="w-20 h-20 bg-emerald-100 rounded-full mx-auto flex items-center justify-center text-emerald-600 animate-pulse">
                <Icons.Check className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black italic uppercase text-main">Redemption Success!</h2>
            <p className="text-muted text-xs font-medium">Your amount will be credited to your account within 24 hours.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-in slide-in-from-right-8 h-full flex flex-col">
       <div className="flex items-center gap-4">
        <button onClick={showBankForm ? () => setShowBankForm(false) : onBack} className="bg-surface p-3 rounded-xl border border-subtle text-main hover:bg-subtle transition-all">←</button>
        <h2 className="text-xl font-black italic uppercase text-main">{showBankForm ? 'Payout Settings' : 'My Earnings'}</h2>
      </div>

      <div className="space-y-6 flex-1 overflow-y-auto custom-scroll flex flex-col pb-20">
          
          {/* EARNINGS CARD */}
          {!showBankForm && (
            <div className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] p-8 rounded-[40px] shadow-2xl text-white relative overflow-hidden flex-shrink-0">
                <div className="absolute top-0 right-0 p-6 opacity-10">
                    <Icons.Logo className="w-32 h-32" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mb-2">Total Earnings</p>
                {/* Display loading state or value */}
                {loading ? (
                    <div className="h-12 w-32 bg-white/20 animate-pulse rounded-xl mb-6" />
                ) : (
                    <h1 className="text-5xl font-black tracking-tight mb-6">₹{user.earnings?.toFixed(2) || '0.00'}</h1>
                )}
                
                <button 
                    onClick={handleRedeemClick}
                    disabled={!user.earnings || user.earnings <= 0 || redeeming || loading}
                    className="w-full bg-white text-main py-4 rounded-[24px] font-black text-[10px] uppercase tracking-widest hover:bg-emerald-50 active:scale-95 transition-all disabled:opacity-50 disabled:bg-slate-600 disabled:text-slate-400"
                >
                    {redeeming ? 'Processing...' : 'Redeem Now'}
                </button>
                <p className="text-[8px] font-bold text-white/40 text-center mt-3 uppercase tracking-wider">Credits within 24 hours</p>
            </div>
          )}

          {/* BANK DETAILS SECTION */}
          {!showBankForm && (
              <div className="bg-surface p-6 rounded-[32px] border border-subtle card-shadow">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-[10px] font-black uppercase text-muted tracking-widest">Payout Method</h3>
                      <button onClick={() => setShowBankForm(true)} className="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-widest bg-[var(--color-primary)]/10 px-3 py-1 rounded-lg">
                          {hasBankDetails ? 'Edit' : 'Add'}
                      </button>
                  </div>
                  
                  {hasBankDetails ? (
                      <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-surface-alt rounded-2xl flex items-center justify-center border border-subtle">
                             <span className="text-lg font-black text-muted">₹</span>
                          </div>
                          <div>
                              <p className="text-xs font-black text-main">{user.bankDetails?.bankName}</p>
                              <p className="text-[10px] font-bold text-muted uppercase">**** {user.bankDetails?.accountNumber.slice(-4)}</p>
                              <p className="text-[9px] font-medium text-muted mt-1">{user.bankDetails?.accountName}</p>
                          </div>
                      </div>
                  ) : (
                      <div onClick={() => setShowBankForm(true)} className="p-4 border border-dashed border-subtle rounded-2xl flex items-center justify-center gap-2 cursor-pointer hover:bg-surface-alt transition-colors">
                          <span className="text-[10px] font-bold text-muted uppercase">+ Add Bank Details</span>
                      </div>
                  )}
              </div>
          )}

          {/* EDIT FORM */}
          {showBankForm ? (
            <form onSubmit={handleSaveBankDetails} className="space-y-4 animate-in slide-in-from-bottom-10 bg-surface p-6 rounded-[32px] border border-subtle card-shadow">
                 <p className="text-xs font-bold text-muted mb-4">Enter your bank details to receive payouts. Ensure these match your bank records.</p>
                 
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted ml-4 tracking-widest">Account Holder Name <span className="text-rose-500">*</span></label>
                    <input 
                        type="text" 
                        required
                        value={bankDetails.accountName} 
                        onChange={e => setBankDetails({...bankDetails, accountName: e.target.value})}
                        placeholder="Name as in Passbook" 
                        className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-main border border-subtle outline-none focus:border-[var(--color-primary)]"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted ml-4 tracking-widest">Account Number <span className="text-rose-500">*</span></label>
                    <input 
                        type="text" 
                        required
                        value={bankDetails.accountNumber} 
                        onChange={e => setBankDetails({...bankDetails, accountNumber: e.target.value})}
                        placeholder="XXXXXXXXXXXX" 
                        className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-main border border-subtle outline-none focus:border-[var(--color-primary)]"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted ml-4 tracking-widest">IFSC Code <span className="text-rose-500">*</span></label>
                    <input 
                        type="text" 
                        required
                        value={bankDetails.ifsc} 
                        onChange={e => setBankDetails({...bankDetails, ifsc: e.target.value.toUpperCase()})}
                        placeholder="SBIN000XXXX" 
                        className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-main border border-subtle outline-none focus:border-[var(--color-primary)]"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted ml-4 tracking-widest">Bank Name <span className="text-rose-500">*</span></label>
                    <input 
                        type="text" 
                        required
                        value={bankDetails.bankName} 
                        onChange={e => setBankDetails({...bankDetails, bankName: e.target.value})}
                        placeholder="State Bank of India" 
                        className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-main border border-subtle outline-none focus:border-[var(--color-primary)]"
                    />
                </div>

                <div className="pt-4">
                    <button disabled={savingBank} className="w-full bg-[var(--color-primary)] text-white py-6 rounded-[30px] font-black text-xs uppercase tracking-widest shadow-2xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3">
                        {savingBank ? 'Saving...' : 'Save Details'}
                    </button>
                    <button type="button" onClick={() => setShowBankForm(false)} className="w-full text-muted py-4 font-bold text-[10px] uppercase tracking-widest hover:text-main mt-2">
                        Cancel
                    </button>
                </div>
            </form>
          ) : (
             /* HISTORY LIST */
             <div className="flex-1 flex flex-col min-h-0">
                <h3 className="text-[10px] font-black uppercase text-muted tracking-widest mb-4">Transaction History</h3>
                <div className="flex-1 space-y-3">
                    {history.length > 0 ? (
                        history.map(tx => (
                            <div key={tx.id} className="bg-surface p-4 rounded-[24px] border border-subtle flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'RIDE_EARNING' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                                        {tx.type === 'RIDE_EARNING' ? <Icons.Car className="w-5 h-5" /> : <Icons.Check className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-main">{tx.type === 'RIDE_EARNING' ? 'Ride Earnings' : 'Withdrawal'}</p>
                                        <p className="text-[9px] text-muted">{new Date(tx.createdAt).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <span className={`font-black text-sm ${tx.type === 'RIDE_EARNING' ? 'text-emerald-600' : 'text-main'}`}>
                                    {tx.type === 'RIDE_EARNING' ? '+' : '-'} ₹{tx.amount.toFixed(2)}
                                </span>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-10 opacity-50">
                            <p className="text-[10px] font-bold uppercase">No transactions yet</p>
                        </div>
                    )}
                </div>
             </div>
          )}
      </div>
    </div>
  );
};
