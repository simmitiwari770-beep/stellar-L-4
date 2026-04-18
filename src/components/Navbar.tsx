'use client';

import { useState } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { NETWORK, EXPLORER_URL } from '@/lib/config';

export default function Navbar() {
  const { connected, publicKey, network, freighterInstalled, isConnecting, connect, disconnect, ledger } =
    useWallet();
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shortKey = publicKey
    ? `${publicKey.slice(0, 6)}...${publicKey.slice(-4)}`
    : null;

  const handleConnect = async () => {
    setError(null);
    try {
      await connect();
    } catch (e: any) {
      setError(e.message || 'Failed to connect');
    }
  };

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-slate-800/50 bg-[#030712]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg glow-indigo">
            <span className="text-lg">⚡</span>
          </div>
          <div>
            <span className="gradient-text text-xl font-bold">SoroVault</span>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 pulse-glow" />
              <span className="text-xs text-slate-400">{NETWORK}</span>
            </div>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Ledger indicator */}
          {ledger > 0 && (
            <div className="hidden items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-900/50 px-3 py-1.5 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              <span className="text-xs text-slate-400">Ledger</span>
              <span className="text-xs font-mono font-medium text-indigo-300">#{ledger.toLocaleString()}</span>
            </div>
          )}

          {/* Wallet button */}
          {!connected ? (
            <div className="flex flex-col items-end gap-1">
              <button
                id="btn-connect-wallet"
                onClick={handleConnect}
                disabled={isConnecting}
                className="btn-primary flex items-center gap-2"
              >
                {isConnecting ? (
                  <>
                    <span className="spinner" />
                    <span>Connecting…</span>
                  </>
                ) : (
                  <>
                    <span>🔗</span>
                    <span>Connect Wallet</span>
                  </>
                )}
              </button>
              {error && <span className="text-xs text-red-400">{error}</span>}
            </div>
          ) : (
            <div className="relative">
              <button
                id="btn-wallet-menu"
                onClick={() => setShowDropdown((v) => !v)}
                className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2.5 text-sm font-medium text-indigo-300 transition-all hover:border-indigo-500/60 hover:bg-indigo-500/20"
              >
                <span className="h-2 w-2 rounded-full bg-green-400" />
                <span className="font-mono">{shortKey}</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-64 glass rounded-xl p-3 shadow-2xl z-50">
                  <div className="mb-3 rounded-lg bg-slate-800/50 p-3">
                    <p className="text-xs text-slate-400 mb-1">Connected Address</p>
                    <p className="text-xs font-mono text-slate-200 break-all">{publicKey}</p>
                  </div>
                  <div className="mb-3 rounded-lg bg-slate-800/50 p-3">
                    <p className="text-xs text-slate-400 mb-1">Network</p>
                    <p className="text-sm font-medium text-indigo-300">{network || NETWORK}</p>
                  </div>
                  {publicKey && (
                    <a
                      href={`${EXPLORER_URL}/account/${publicKey}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/50 transition-colors"
                    >
                      <span>🔍</span> View on Explorer
                    </a>
                  )}
                  <button
                    id="btn-disconnect"
                    onClick={() => { disconnect(); setShowDropdown(false); }}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    🔌 Disconnect
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
