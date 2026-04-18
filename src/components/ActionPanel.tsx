'use client';

import VaultPanel from './VaultPanel';
import { ShieldCheck } from 'lucide-react';

export default function ActionPanel() {
  return (
    <div className="group relative rounded-[2rem] bg-slate-900/40 border border-slate-800/60 shadow-2xl shadow-indigo-500/5 backdrop-blur-xl transition-all hover:border-indigo-500/20 overflow-hidden">
        {/* Animated Glow Component */}
        <div className="absolute -left-20 -top-20 h-40 w-40 rounded-full bg-indigo-500/5 blur-3xl transition-opacity group-hover:opacity-40" />
        
        <div className="relative flex items-center justify-between border-b border-slate-800/60 bg-slate-900/40 px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-inner">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">Vault Controls</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Protocol Version 1.0.4</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 pulse-glow" />
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Verified</span>
          </div>
        </div>

        <div className="p-8 overflow-y-auto max-h-[700px] custom-scrollbar">
          <VaultPanel />
        </div>
        
        {/* Footer detail */}
        <div className="bg-slate-900/30 px-8 py-4 border-t border-slate-800/40 flex items-center justify-between">
           <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Audited by SoroShield</span>
           <span className="text-[9px] font-bold text-indigo-500/50 uppercase tracking-widest">Gas Efficient</span>
        </div>
    </div>
  );
}
