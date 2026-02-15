import React, { useState } from 'react';
import { User } from '../types';
import { kycService, storageService } from '../services/firebaseService';

interface Props {
  user: User;
  onBack: () => void;
  onSuccess: () => void;
}

export const CustomerKYC: React.FC<Props> = ({ user, onBack, onSuccess }) => {
  const [aadhaar, setAadhaar] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setUploadError(null);

     // Pre-flight check
     if (!user || !user.id) {
        setUploadError("Session invalid. Please login again.");
        setLoading(false);
        return;
    }

    let docUrl = '';
    if (file) {
        // Upload file first
        // FIXED: Using 'user_uploads' to match Firebase Storage Rules
        const path = `user_uploads/${user.id}/aadhaar_${Date.now()}`;
        const { url, error } = await storageService.uploadKYC(file, path);
        
        if (error) {
            setUploadError(error);
            setLoading(false);
            return;
        }

        if (url) docUrl = url;
    } else {
        setUploadError("Please select a photo of your Aadhaar card.");
        setLoading(false);
        return;
    }

    const { error } = await kycService.submitCustomerKYC(user.id, { aadhaar, docUrl });
    setLoading(false);

    if (error) {
        setUploadError("Failed to verify identity. Please try again.");
    } else {
        onSuccess();
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in slide-in-from-bottom-10 h-full flex flex-col">
       <div className="flex items-center gap-4">
        <button onClick={onBack} className="bg-surface p-3 rounded-xl border border-subtle text-main hover:bg-subtle transition-all">←</button>
        <h2 className="text-xl font-black italic uppercase text-main">Verify Identity</h2>
      </div>

      <div className="bg-surface p-8 rounded-[40px] border border-subtle card-shadow space-y-6">
        <p className="text-sm font-medium text-muted">To keep the community safe, we require all users to verify their Government ID (Aadhaar).</p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted ml-4 tracking-widest">Aadhaar Number</label>
                <input 
                    type="text" 
                    value={aadhaar} 
                    onChange={e => setAadhaar(e.target.value)} 
                    placeholder="XXXX XXXX XXXX" 
                    className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-main border border-subtle outline-none focus:border-[var(--color-primary)]"
                    maxLength={12}
                    required
                />
            </div>

            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted ml-4 tracking-widest">Aadhaar Photo</label>
                <input 
                    type="file" 
                    accept="image/*"
                    onChange={e => setFile(e.target.files?.[0] || null)}
                    className="w-full bg-surface-alt p-4 rounded-[24px] font-bold text-[10px] text-muted border border-subtle file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-[var(--color-primary)] file:text-white"
                />
            </div>

            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">Note: Verification typically takes 2-4 hours.</p>
            </div>

            {uploadError && (
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl text-center">
                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-wide">{uploadError}</p>
                </div>
            )}

            <button disabled={loading || aadhaar.length < 12} className="w-full bg-[var(--color-primary)] text-white py-6 rounded-[30px] font-black text-xs uppercase tracking-widest shadow-2xl transition-all active:scale-95 disabled:opacity-50">
                {loading ? 'Uploading & Verifying...' : 'Submit for Verification'}
            </button>
        </form>
      </div>
    </div>
  );
};
