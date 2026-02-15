import React, { useState } from 'react';
import { User } from '../types';
import { userService, kycService } from '../services/firebaseService';
import { Icons } from '../constants';

interface Props {
  user: User;
  onSuccess: (role: 'driver' | 'passenger') => void;
}

export const ProfileSetup: React.FC<Props> = ({ user, onSuccess }) => {
  const [name, setName] = useState(user.name || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [address, setAddress] = useState(user.address || '');
  const [sex, setSex] = useState<'Male' | 'Female' | 'Other'>(user.sex || 'Male');
  const [bloodGroup, setBloodGroup] = useState(user.bloodGroup || '');
  const [emergencyContact, setEmergencyContact] = useState(user.emergencyContact || '');
  const [role, setRole] = useState<'passenger' | 'driver'>('passenger');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Strict Phone Validation
    if (!phone || phone.length < 10) {
        alert("Please enter a valid phone number.");
        return;
    }

    setLoading(true);

    const commonUpdates = {
      name,
      phone,
      address,
      sex,
      bloodGroup,
      emergencyContact,
      isOnboarded: true,
      // If they select driver, we set the flag in the user profile too
      isDriver: role === 'driver' 
    };

    try {
        // 1. Always update the main user profile (users collection)
        const { error } = await userService.updateProfile(user.id, commonUpdates);
        
        if (error) {
            throw new Error(error.message);
        }

        // 2. If Driver, save details to 'drivers' collection as well
        if (role === 'driver') {
            await kycService.registerDriverBasicInfo(user.id, {
                name,
                phone,
                address,
                sex
            });
        }

        setLoading(false);
        onSuccess(role);

    } catch (err: any) {
        setLoading(false);
        alert("Failed to save profile: " + err.message);
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in slide-in-from-bottom-10 h-full flex flex-col pb-32">
       <div className="text-center space-y-4">
         <div className="w-24 h-24 mx-auto rounded-full p-1 border-2 border-[var(--color-primary)]">
            <img src={user.avatar} className="w-full h-full rounded-full object-cover" />
         </div>
         <h2 className="text-3xl font-black italic uppercase text-main tracking-tighter">Complete Profile</h2>
         <p className="text-muted text-xs font-bold">Help the community know you better.</p>
       </div>

      <div className="bg-surface p-8 rounded-[40px] border border-subtle card-shadow">
        <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Role Selection */}
            <div className="space-y-3">
                 <label className="text-[10px] font-black uppercase text-muted ml-4 tracking-widest">I want to...</label>
                 <div className="grid grid-cols-2 gap-4">
                     <button
                        type="button"
                        onClick={() => setRole('passenger')}
                        className={`p-4 rounded-[24px] border-2 transition-all flex flex-col items-center gap-2 ${role === 'passenger' ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10' : 'border-subtle hover:bg-surface-alt'}`}
                     >
                        <div className={`p-2 rounded-full ${role === 'passenger' ? 'bg-[var(--color-primary)] text-white' : 'bg-surface-alt text-muted'}`}>
                             <Icons.User className="w-5 h-5" />
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${role === 'passenger' ? 'text-[var(--color-primary)]' : 'text-muted'}`}>Find a Ride</span>
                     </button>

                     <button
                        type="button"
                        onClick={() => setRole('driver')}
                        className={`p-4 rounded-[24px] border-2 transition-all flex flex-col items-center gap-2 ${role === 'driver' ? 'border-[#EA580C] bg-[#EA580C]/10' : 'border-subtle hover:bg-surface-alt'}`}
                     >
                        <div className={`p-2 rounded-full ${role === 'driver' ? 'bg-[#EA580C] text-white' : 'bg-surface-alt text-muted'}`}>
                             <Icons.Car className="w-5 h-5" />
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${role === 'driver' ? 'text-[#EA580C]' : 'text-muted'}`}>Offer Rides</span>
                     </button>
                 </div>
            </div>

            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted ml-4 tracking-widest">Full Name</label>
                <input 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="Your Name" 
                    className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-main border border-subtle outline-none focus:border-[var(--color-primary)]"
                    required
                />
            </div>

            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted ml-4 tracking-widest">Phone Number <span className="text-rose-500">*</span></label>
                <input 
                    type="tel" 
                    value={phone} 
                    onChange={e => setPhone(e.target.value)} 
                    placeholder="+91 99999 99999" 
                    className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-main border border-subtle outline-none focus:border-[var(--color-primary)]"
                    required
                />
            </div>

             <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted ml-4 tracking-widest">Sex</label>
                <div className="flex bg-surface-alt p-1 rounded-[24px] border border-subtle">
                  {['Male', 'Female', 'Other'].map((option) => (
                    <button 
                      key={option}
                      type="button" 
                      onClick={() => setSex(option as any)} 
                      className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${sex === option ? 'bg-main text-white shadow-lg' : 'text-muted hover:text-main'}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted ml-4 tracking-widest">Address</label>
                <textarea 
                    value={address} 
                    onChange={e => setAddress(e.target.value)} 
                    placeholder="House No, Street, City..." 
                    rows={3}
                    className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-main border border-subtle outline-none focus:border-[var(--color-primary)] resize-none"
                    required
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted ml-4 tracking-widest">Blood Group</label>
                    <select 
                        value={bloodGroup} 
                        onChange={e => setBloodGroup(e.target.value)} 
                        className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-main border border-subtle outline-none focus:border-[var(--color-primary)] appearance-none"
                    >
                        <option value="">Select</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted ml-4 tracking-widest">Emergency No.</label>
                    <input 
                        type="tel" 
                        value={emergencyContact} 
                        onChange={e => setEmergencyContact(e.target.value)} 
                        placeholder="Family member" 
                        className="w-full bg-surface-alt p-5 rounded-[24px] font-bold text-main border border-subtle outline-none focus:border-[var(--color-primary)]"
                    />
                </div>
            </div>

            <button disabled={loading} className="w-full bg-[var(--color-primary)] text-white py-6 rounded-[30px] font-black text-xs uppercase tracking-widest shadow-2xl transition-all active:scale-95 disabled:opacity-50">
                {loading ? 'Saving Profile...' : 'Continue to TripIn'}
            </button>
        </form>
      </div>
    </div>
  );
};