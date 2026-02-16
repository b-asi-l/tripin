
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
        onSuccess();
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in slide-in-from-bottom-10 h-full flex flex-col">
       <div className="flex items-center gap-4">
        {/* If user is not verified, they shouldn't go back easily if this is mandatory onboarding */}
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
                    maxLength={14} // Allow for spaces
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
