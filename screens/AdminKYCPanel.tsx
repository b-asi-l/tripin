import React from 'react';

interface Props {
  onBack: () => void;
}

export const AdminKYCPanel: React.FC<Props> = ({ onBack }) => {
  return (
    <div className="p-8 space-y-8 animate-in fade-in h-full bg-[#064E3B] text-emerald-50">
       <div className="flex items-center gap-4">
        <button onClick={onBack} className="bg-white/10 p-3 rounded-xl border border-white/20 hover:bg-white/20 transition-all">←</button>
        <h2 className="text-xl font-black italic uppercase">Admin Control</h2>
      </div>

      <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest opacity-70">Pending KYCs</h3>
          
          <div className="bg-white/10 p-6 rounded-[32px] border border-white/10 backdrop-blur-lg">
              <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 rounded-full bg-white/20"></div>
                  <div>
                      <p className="font-bold text-sm">John Doe</p>
                      <p className="text-[10px] opacity-70">Aadhaar Verification</p>
                  </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                  <button className="bg-rose-500/80 p-2 rounded-xl text-[10px] font-black uppercase">Reject</button>
                  <button className="bg-[var(--color-primary)] p-2 rounded-xl text-[10px] font-black uppercase">Approve</button>
              </div>
          </div>
          
           <div className="bg-white/10 p-6 rounded-[32px] border border-white/10 backdrop-blur-lg">
              <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 rounded-full bg-white/20"></div>
                  <div>
                      <p className="font-bold text-sm">Arun K</p>
                      <p className="text-[10px] opacity-70">Driver License</p>
                  </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                  <button className="bg-rose-500/80 p-2 rounded-xl text-[10px] font-black uppercase">Reject</button>
                  <button className="bg-[var(--color-primary)] p-2 rounded-xl text-[10px] font-black uppercase">Approve</button>
              </div>
          </div>
      </div>
    </div>
  );
};