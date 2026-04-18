'use client';

import { useWallet } from '@/contexts/WalletContext';
import { CONTRACTS, EXPLORER_URL } from '@/lib/config';
import { Wallet, Landmark, Gift, ExternalLink, Activity } from 'lucide-react';

function MiniStat({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <div className="group relative flex items-center gap-4 rounded-3xl border border-slate-700/40 bg-slate-900/60 p-5 transition-all hover:bg-slate-900/80 hover:border-slate-600/60 overflow-hidden">
      <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-10 blur-xl transition-opacity group-hover:opacity-20" style={{ backgroundColor: color }} />
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-800/80 text-2xl shadow-inner border border-slate-700/50">
        <Icon className="h-7 w-7" style={{ color }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
        <p className="truncate text-2xl font-black text-white" style={{ color }}>{value}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { connected, tokenBalance, vaultBalance, pendingRewards } = useWallet();

  return (
    <div className="space-y-6">
      {/* Header with Title & TVL */}
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between mb-2">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
             <Activity className="h-3 w-3 text-indigo-400" />
             <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Protocol Live</span>
          </div>
          <h1 className="text-5xl font-black tracking-tighter text-white sm:text-6xl">
            Soro<span className="text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 via-purple-500 to-pink-500">Vault</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-md font-medium leading-relaxed">
            The next generation of yields on <span className="text-slate-200">Stellar Soroban</span>. Secure, transparent, and high-performance.
          </p>
        </div>
 
        <div className="relative group">
           <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
           <div className="relative flex items-center gap-4 rounded-3xl bg-slate-950 p-3 pr-8 border border-white/5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-3xl shadow-lg shadow-indigo-500/20">
               <Landmark className="h-8 w-8 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400/80">Total Locked Value</p>
              <p className="text-4xl font-black text-white leading-none mt-1">{connected ? vaultBalance : '0.00'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MiniStat 
          label="SST Balance" 
          value={connected ? tokenBalance : '0.00'} 
          icon={Wallet} 
          color="#818cf8" 
        />
        <MiniStat 
          label="Staked in Vault" 
          value={connected ? vaultBalance : '0.00'} 
          icon={Landmark} 
          color="#34d399" 
        />
        <MiniStat 
          label="Pending Earnings" 
          value={connected ? pendingRewards : '0.00'} 
          icon={Gift} 
          color="#f472b6" 
        />
      </div>

      {/* Mini Wallet Row */}
      {connected && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-6 rounded-3xl bg-indigo-500/5 p-6 border border-indigo-500/10 backdrop-blur-sm">
          <div className="flex items-center gap-4">
             <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Asset</span>
             <div className="flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-xl border border-slate-800">
               <span className="text-sm font-bold text-white">SST</span>
             </div>
          </div>
          
          <div className="h-px sm:h-8 w-full sm:w-px bg-slate-800" />
 
          <div className="flex gap-8">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-indigo-400/60 uppercase tracking-widest">Wallet</span>
              <p className="text-lg font-black text-white leading-none">{tokenBalance}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-emerald-400/60 uppercase tracking-widest">Vault</span>
              <p className="text-lg font-black text-white leading-none">{vaultBalance}</p>
            </div>
          </div>
 
          <div className="sm:ml-auto flex gap-3">
             {CONTRACTS.VAULT && (
               <a 
                 href={`${EXPLORER_URL}/contract/${CONTRACTS.VAULT}`}
                 target="_blank"
                 rel="noopener noreferrer"
                 className="group flex items-center gap-2 text-[10px] font-bold text-slate-500 hover:text-indigo-400 transition-all bg-slate-900/50 px-4 py-2 rounded-2xl border border-slate-800 hover:border-indigo-500/30"
               >
                 <span>Vault: {CONTRACTS.VAULT.slice(0, 6)}...{CONTRACTS.VAULT.slice(-4)}</span>
                 <ExternalLink className="h-3 w-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
               </a>
             )}
          </div>
        </div>
      )}
    </div>
  );
}
