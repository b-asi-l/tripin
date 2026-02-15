import React, { useState } from 'react';
import { User, VehicleType } from '../types';
import { kycService, storageService } from '../services/firebaseService';
import { Icons } from '../constants';

interface Props {
  user: User;
  onBack: () => void;
  onSuccess: () => void;
}

export const DriverKYC: React.FC<Props> = ({ user, onBack, onSuccess }) => {
  const [license, setLicense] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>(VehicleType.CAR);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [vehicleFile, setVehicleFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // If already pending or just submitted, show status screen instead of form
  if (user.driverVerificationStatus === 'PENDING' || isSubmitted) {
      return (
          <div className="p-8 h-full flex flex-col items-center justify-center animate-in zoom-in-95">
            <div className="bg-surface p-8 rounded-[48px] border border-subtle card-shadow text-center space-y-6 relative overflow-hidden w-full">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 to-amber-600"></div>
                
                <div className="w-20 h-20 bg-amber-100 rounded-full mx-auto flex items-center justify-center text-amber-600 animate-pulse">
                    <Icons.Shield className="w-10 h-10" />
                </div>
                
                <h2 className="text-2xl font-black italic uppercase text-main tracking-tighter">Request Under Processing</h2>
                <p className="text-muted text-xs font-medium leading-relaxed">
                    Your request is currently being processed. Our admin team is reviewing your 
                    <strong className="text-main"> License</strong> and <strong className="text-main">Vehicle</strong> documents.
                </p>
                
                <div className="bg-surface-alt p-4 rounded-2xl border border-subtle">
                     <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">Estimated Time</p>
                     <p className="text-sm font-bold text-main">2 - 4 Hours</p>
                </div>

                <button onClick={onBack} className="w-full bg-surface-alt text-main py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-subtle hover:bg-subtle transition-all">
                    Back to Profile
                </button>
            </div>
          </div>
      );
  }

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

    if (!licenseFile || !vehicleFile) {
        setUploadError("Please upload both License Photo and Vehicle Photo.");
        setLoading(false);
        return;
    }

    let docUrl = '';
    let vehicleUrl = '';

    try {
        // Upload License
        const licensePath = `user_uploads/${user.id}/${Date.now()}_license`;
        const { url: lUrl, error: lError } = await storageService.uploadKYC(licenseFile, licensePath);
        if (lError) throw new Error(lError);
        docUrl = lUrl || '';

        // Upload Vehicle Photo to 'vehicle_docs' folder as requested
        const vehiclePath = `vehicle_docs/${user.id}/${Date.now()}_vehicle`;
        const { url: vUrl, error: vError } = await storageService.uploadKYC(vehicleFile, vehiclePath);
        if (vError) throw new Error(vError);
        vehicleUrl = vUrl || '';

        // Submit to drivers and vehicles collection
        const { error } = await kycService.submitDriverKYC(user.id, { 
            license, 
            vehicleNo, 
            docUrl, 
            vehicleUrl,
            vehicleType
        });
        
        if (error) throw new Error("Failed to submit application. Please try again.");

        setLoading(false);
        setIsSubmitted(true); // Immediately show the pending screen
        onSuccess();

    } catch (err: any) {
        setLoading(false);
        setUploadError(err.message || "An error occurred during upload.");
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in slide-in-from-bottom-10 h-full flex flex-col">
       <div className="flex items-center gap-4">
        {user.driverVerificationStatus !== 'PENDING' && (
           <button onClick={onBack} className="bg-surface p-3 rounded-xl border border-subtle text-main hover:bg-subtle transition-all">←</button>
        )}
        <h2 className="text-xl font-black italic uppercase text-main">Driver Registration</h2>
      </div>

      <div className="bg-surface p-8 rounded-[40px] border border-subtle card-shadow space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted ml-4 tracking-widest">Vehicle Type</label>
                <div className="flex bg-surface-alt p-1 rounded-[24px] border border-subtle">
                  <button type="button" onClick={() => setVehicleType(VehicleType.CAR)} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${vehicleType === VehicleType.CAR ? 'bg-[var(--color-primary)] text-white shadow-lg' : 'text-muted hover:text-main'}`}>Car</button>
                  <button type="button" onClick={() => setVehicleType(VehicleType.BIKE)} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${vehicleType === VehicleType.BIKE ? 'bg-[#EA580C] text-white shadow-lg' : 'text-muted hover:text-main'}`}>Bike</button>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted ml-4 tracking-widest">License Number</label>
                <input 
                    type="text" 
                    value={license} 
                    onChange={e => setLicense(e.target.value)} 
                    placeholder="KL XX YYYY" 
                    className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-main border border-subtle outline-none focus:border-[#EA580C]"
                    required
                />
            </div>
             <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted ml-4 tracking-widest">Vehicle Number</label>
                <input 
                    type="text" 
                    value={vehicleNo} 
                    onChange={e => setVehicleNo(e.target.value)} 
                    placeholder="KL 01 CA 1234" 
                    className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-main border border-subtle outline-none focus:border-[#EA580C]"
                    required
                />
            </div>

            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted ml-4 tracking-widest">License Photo</label>
                <input 
                    type="file" 
                    accept="image/*"
                    onChange={e => setLicenseFile(e.target.files?.[0] || null)}
                    className="w-full bg-surface-alt p-4 rounded-[24px] font-bold text-[10px] text-muted border border-subtle file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-[#EA580C] file:text-white"
                />
            </div>

            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted ml-4 tracking-widest">Vehicle Photo</label>
                <input 
                    type="file" 
                    accept="image/*"
                    onChange={e => setVehicleFile(e.target.files?.[0] || null)}
                    className="w-full bg-surface-alt p-4 rounded-[24px] font-bold text-[10px] text-muted border border-subtle file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-[var(--color-primary)] file:text-white"
                />
            </div>

            {uploadError && (
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl text-center">
                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-wide">{uploadError}</p>
                </div>
            )}

            <button disabled={loading} className="w-full bg-[#EA580C] text-white py-6 rounded-[30px] font-black text-xs uppercase tracking-widest shadow-2xl transition-all active:scale-95 disabled:opacity-50">
                {loading ? 'Uploading & Registering...' : 'Register Vehicle'}
            </button>
        </form>
      </div>
    </div>
  );
};