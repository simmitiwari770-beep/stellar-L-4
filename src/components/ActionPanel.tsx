'use client';

import VaultPanel from './VaultPanel';

export default function ActionPanel() {
  return (
    <div className="card !p-0 overflow-hidden border-indigo-500/20 shadow-2xl shadow-indigo-500/10">
        <div className="flex border-b border-slate-700/50 bg-slate-900/60 p-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-indigo-400">⚡</span> Vault Dashboard
          </h2>
        </div>
        <div className="p-6 overflow-y-auto max-h-[600px] custom-scrollbar">
          <VaultPanel />
        </div>
    </div>
  );
}
