
import React, { useState } from 'react';
import { User } from '../types';
import { kycService, storageService } from '../services/firebaseService';
import { Icons } from '../constants';

interface Props {
  user: User;
  onBack: () => void;
  onSuccess: () => void;
}

export const CustomerKYC: React.FC<Props> = ({ user, onBack, onSuccess }) => {
  const [aadhaar, setAadhaar] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Show pending screen if data exists but not verified, or if just submitted
  const showPending = (user.kycData && !user.isVerified) || isSubmitted;

  if (showPending) {
      return (
          <div className="p-8 h-full flex flex-col items-center justify-center animate-in zoom-in-95">
            <div className="bg-surface p-8 rounded-[48px] border border-subtle card-shadow text-center space-y-6 relative overflow-hidden w-full">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 to-amber-600"></div>
                
                <div className="w-20 h-20 bg-amber-100 rounded-full mx-auto flex items-center justify-center text-amber-600 animate-pulse">
                    <Icons.Shield className="w-10 h-10" />
                </div>
                
                <h2 className="text-2xl font-black italic uppercase text-main tracking-tighter">Verification Pending</h2>
                <p className="text-muted text-xs font-medium leading-relaxed">
                    Your Identity proof has been submitted. We are currently verifying your Aadhaar details.
                </p>
                
                <div className="bg-surface-alt p-4 rounded-2xl border border-subtle">
                     <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">Estimated Time</p>
                     <p className="text-sm font-bold text-main">~ 2 Hours</p>
                </div>

                <button onClick={onBack} className="w-full bg-surface-alt text-main py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-subtle hover:bg-subtle transition-all">
                    Back to Profile
                </button>
            </div>
          </div>
      );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
          setFile(selectedFile);
          setPreviewUrl(URL.createObjectURL(selectedFile));
      }
  };

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

    // Aadhaar Validation
    if (!/^\d{12}$/.test(aadhaar.replace(/\s/g, ''))) {
        setUploadError("Please enter a valid 12-digit Aadhaar number.");
        setLoading(false);
        return;
    }

    let docUrl = '';
    if (file) {
        // Upload file to specific Aadhaar folder in Storage
        const path = `aadhaar_documents/${user.id}/aadhaar_${Date.now()}`;
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
        setIsSubmitted(true);
        // Delay onSuccess to let the user see the pending screen briefly 
        // before potentially being redirected by the parent component
        setTimeout(() => {
            onSuccess();
        }, 2000);
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in slide-in-from-bottom-10 h-full flex flex-col">
       <div className="flex items-center gap-4">
        <button onClick={onBack} className="bg-surface p-3 rounded-xl border border-subtle text-main hover:bg-subtle transition-all">←</button>
        <h2 className="text-xl font-black italic uppercase text-main">Mandatory KYC</h2>
      </div>

      <div className="bg-surface p-8 rounded-[40px] border border-subtle card-shadow space-y-6">
        <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
             <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 shrink-0">
                 <Icons.Shield className="w-5 h-5" />
             </div>
             <p className="text-xs font-bold text-amber-800 leading-tight">Govt. ID Verification is required for both Riders and Drivers to ensure community safety.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted ml-4 tracking-widest">Aadhaar Number</label>
                <input 
                    type="text" 
                    value={aadhaar} 
                    onChange={e => setAadhaar(e.target.value)} 
                    placeholder="XXXX XXXX XXXX" 
                    className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-main border border-subtle outline-none focus:border-[var(--color-primary)]"
                    maxLength={14} 
                    required
                />
            </div>

            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted ml-4 tracking-widest">Aadhaar Card Photo</label>
                
                {previewUrl ? (
                    <div className="relative w-full h-48 rounded-[24px] overflow-hidden border border-subtle group">
                        <img src={previewUrl} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                             <p className="text-white font-bold text-xs uppercase">Click to Change</p>
                        </div>
                        <input 
                            type="file" 
                            accept="image/*"
                            onChange={handleFileChange}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                    </div>
                ) : (
                    <div className="relative">
                        <input 
                            type="file" 
                            accept="image/*"
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="w-full bg-surface-alt p-8 rounded-[24px] border border-dashed border-subtle flex flex-col items-center justify-center gap-2 text-muted">
                            <Icons.Plus />
                            <span className="text-[10px] font-black uppercase">Tap to Upload Image</span>
                        </div>
                    </div>
                )}
            </div>

            {uploadError && (
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl text-center animate-in fade-in">
                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-wide">{uploadError}</p>
                </div>
            )}

            <button disabled={loading || aadhaar.length < 12 || !file} className="w-full bg-[var(--color-primary)] text-white py-6 rounded-[30px] font-black text-xs uppercase tracking-widest shadow-2xl transition-all active:scale-95 disabled:opacity-50 disabled:grayscale">
                {loading ? 'Uploading Securely...' : 'Submit Aadhaar'}
            </button>
        </form>
      </div>
    </div>
  );
};
