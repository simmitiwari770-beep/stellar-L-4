'use client';

import { useWallet } from '@/contexts/WalletContext';
import { CONTRACTS, EXPLORER_URL } from '@/lib/config';

function MiniStat({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-700/50 bg-slate-900/60 p-4 transition-all hover:bg-slate-900/80">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-2xl shadow-inner">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
        <p className="truncate text-xl font-bold text-white xl:text-2xl" style={{ color }}>{value}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { connected, tokenBalance, vaultBalance, pendingRewards } = useWallet();

  return (
    <div className="space-y-6">
      {/* Header with Title & TVL */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Soro<span className="gradient-text">Vault</span>
          </h1>
          <p className="text-slate-400">Next-gen DeFi on Stellar Soroban.</p>
        </div>

        <div className="flex items-center gap-4 rounded-3xl bg-indigo-500/10 p-2 pr-6 border border-indigo-500/20 glow-indigo">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500 text-3xl shadow-lg shadow-indigo-500/40">
            🏦
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">Total Vault TVL</p>
            <p className="text-3xl font-black text-white">{connected ? vaultBalance : '0.00'}</p>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MiniStat 
          label="Wallet Balance" 
          value={connected ? tokenBalance : '0.00'} 
          icon="🪙" 
          color="#818cf8" 
        />
        <MiniStat 
          label="Vault Balance" 
          value={connected ? vaultBalance : '0.00'} 
          icon="🏦" 
          color="#34d399" 
        />
        <MiniStat 
          label="Pending Rewards" 
          value={connected ? pendingRewards : '0.00'} 
          icon="🎁" 
          color="#f472b6" 
        />
      </div>

      {/* Mini Wallet Row */}
      {connected && (
        <div className="flex flex-wrap items-center gap-6 rounded-2xl bg-indigo-500/5 p-4 border border-indigo-500/10">
          <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Balances</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-indigo-300 font-medium">TOKEN:</span>
            <span className="text-sm font-bold text-white">{tokenBalance}</span>
          </div>
          <div className="h-1 w-1 rounded-full bg-slate-700" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-indigo-300 font-medium">VAULT:</span>
            <span className="text-sm font-bold text-white">{vaultBalance}</span>
          </div>
          <div className="ml-auto flex gap-3">
             {CONTRACTS.VAULT && (
               <a 
                 href={`${EXPLORER_URL}/contract/${CONTRACTS.VAULT}`}
                 target="_blank"
                 rel="noopener noreferrer"
                 className="text-[10px] font-bold text-slate-500 hover:text-indigo-400 transition-colors bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700/50"
               >
                 Vault: {CONTRACTS.VAULT.slice(0, 6)}...{CONTRACTS.VAULT.slice(-4)} ↗
               </a>
             )}
          </div>
        </div>
      )}
    </div>
  );
}
