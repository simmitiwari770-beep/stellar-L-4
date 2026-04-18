'use client';

import { useState } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { Loader2, ArrowDownCircle, ArrowUpCircle, Sparkles, Wallet } from 'lucide-react';
import { signTransaction } from '@stellar/freighter-api';
import { getLatestLedger } from '@/lib/stellar';

export default function VaultPanel() {
  const { connected, publicKey, refreshBalances, vaultBalance, pendingRewards, addTransaction } = useWallet();
  
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleDeposit = async () => {
    setError(null);
    setTxHash(null);
    if (!connected || !publicKey || !CONTRACTS.VAULT || !CONTRACTS.TOKEN) return;
    try {
      setLoading('deposit');
      const amountNative = BigInt(Math.floor(parseFloat(depositAmount) * TOKEN_FACTOR));
      const currentLedger = await getLatestLedger();
      const expirationLedger = currentLedger.sequence + 5000;
      
      const approveXdr = await buildContractCallXdr(
        publicKey,
        CONTRACTS.TOKEN,
        'approve',
        [
          new Address(publicKey).toScVal(),
          new Address(CONTRACTS.VAULT).toScVal(),
          nativeToScVal(amountNative, { type: 'i128' }),
          nativeToScVal(expirationLedger, { type: 'u32' }),
        ]
      );
      
      const signedApprove = await signTransaction(approveXdr, { network: "TESTNET" });
      const approveRes = await simulateAndSend(signedApprove);
      if (approveRes.status !== 'PENDING') throw new Error('Approve failed');
      await waitForTransaction(approveRes.hash);
      
      // Step 2: Deposit to Vault
      const depositXdr = await buildContractCallXdr(
        publicKey,
        CONTRACTS.VAULT,
        'deposit',
        [
          new Address(publicKey).toScVal(),
          nativeToScVal(amountNative, { type: 'i128' }),
        ]
      );
      
      const signedDeposit = await signTransaction(depositXdr, { network: "TESTNET" });
      const depositRes = await simulateAndSend(signedDeposit);
      
      addTransaction({
        id: depositRes.hash,
        hash: depositRes.hash,
        type: 'deposit',
        status: 'pending',
        amount: depositAmount,
        timestamp: Date.now()
      });
      
      await waitForTransaction(depositRes.hash);
      
      setTxHash(depositRes.hash);
      setDepositAmount('');
      refreshBalances();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Deposit failed');
    } finally {
      setLoading(null);
    }
  };

  const handleWithdraw = async () => {
    setError(null);
    setTxHash(null);
    if (!connected || !publicKey || !CONTRACTS.VAULT) return;
    try {
      setLoading('withdraw');
      const amountNative = BigInt(Math.floor(parseFloat(withdrawAmount) * TOKEN_FACTOR));
      const withdrawXdr = await buildContractCallXdr(
        publicKey,
        CONTRACTS.VAULT,
        'withdraw',
        [
          new Address(publicKey).toScVal(),
          nativeToScVal(amountNative, { type: 'i128' }),
        ]
      );
      
      const signedWithdraw = await signTransaction(withdrawXdr, { network: "TESTNET" });
      const withdrawRes = await simulateAndSend(signedWithdraw);
      
      addTransaction({
        id: withdrawRes.hash,
        hash: withdrawRes.hash,
        type: 'withdraw',
        status: 'pending',
        amount: withdrawAmount,
        timestamp: Date.now()
      });
      
      await waitForTransaction(withdrawRes.hash);
      
      setTxHash(withdrawRes.hash);
      setWithdrawAmount('');
      refreshBalances();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Withdraw failed');
    } finally {
      setLoading(null);
    }
  };

  const handleClaim = async () => {
    setError(null);
    setTxHash(null);
    if (!connected || !publicKey || !CONTRACTS.VAULT) return;
    try {
      setLoading('claim');
      const claimXdr = await buildContractCallXdr(
        publicKey,
        CONTRACTS.VAULT,
        'claim_rewards',
        [
          new Address(publicKey).toScVal(),
        ]
      );
      
      const signedClaim = await signTransaction(claimXdr, { network: "TESTNET" });
      const claimRes = await simulateAndSend(signedClaim);
      
      addTransaction({
        id: claimRes.hash,
        hash: claimRes.hash,
        type: 'claim',
        status: 'pending',
        amount: pendingRewards,
        timestamp: Date.now()
      });
      
      await waitForTransaction(claimRes.hash);
      
      setTxHash(claimRes.hash);
      refreshBalances();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Claim failed');
    } finally {
      setLoading(null);
    }
  };

  if (!connected) {
    return (
      <div className="flex min-h-[340px] flex-col items-center justify-center space-y-6 rounded-3xl bg-slate-900/40 p-8 text-center border border-slate-800/60 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-800/50 shadow-inner">
           <Wallet className="h-10 w-10 text-slate-500" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-bold text-white tracking-tight">Wallet Disconnected</h3>
          <p className="mx-auto max-w-[240px] text-sm text-slate-400 leading-relaxed">
            Please connect your Freighter wallet to interact with the SoroVault protocol.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Error & Success Messages */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}
      {txHash && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-300">
          ✅ Transaction confirmed!{' '}
          <a
            href={`${EXPLORER_URL}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-green-200"
          >
            View →
          </a>
        </div>
      )}

      {/* Deposit Section */}
      <div className="group space-y-5 rounded-3xl bg-slate-900/40 p-6 border border-slate-800/50 transition-all hover:bg-slate-900/60">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
              <ArrowDownCircle className="h-5 w-5" />
            </div>
            Deposit Tokens
          </h3>
          <button 
            onClick={() => setDepositAmount(useWallet().tokenBalance)}
            className="text-[10px] font-bold text-indigo-400/70 hover:text-indigo-400 uppercase tracking-widest px-2 py-1 rounded-md bg-indigo-500/5 border border-indigo-500/10 transition-colors"
          >
            Use Max: {useWallet().tokenBalance}
          </button>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <input
              type="number"
              min="0"
              className="input-field w-full pr-12"
              placeholder="0.00"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">SST</span>
          </div>
          <button
            onClick={handleDeposit}
            disabled={loading !== null || !depositAmount || parseFloat(depositAmount) <= 0}
            className="btn-primary min-w-[140px] py-3 shadow-lg shadow-indigo-500/20"
          >
            {loading === 'deposit' ? <Loader2 className="animate-spin h-5 w-5" /> : 'Deposit Now'}
          </button>
        </div>
      </div>

      <div className="h-px bg-slate-700/50 my-6" />

      {/* Withdraw Section */}
      <div className="group space-y-5 rounded-3xl bg-slate-900/40 p-6 border border-slate-800/50 transition-all hover:bg-slate-900/60">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-3">
             <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-500/20 text-pink-400">
               <ArrowUpCircle className="h-5 w-5" />
             </div>
            Withdraw Tokens
          </h3>
          <button 
            onClick={() => setWithdrawAmount(vaultBalance)}
            className="text-[10px] font-bold text-pink-400/70 hover:text-pink-400 uppercase tracking-widest px-2 py-1 rounded-md bg-pink-500/5 border border-pink-500/10 transition-colors"
          >
            Max Vault: {vaultBalance}
          </button>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
           <div className="relative flex-1">
            <input
              type="number"
              min="0"
              max={vaultBalance}
              className="input-field w-full pr-12 focus:border-pink-500/50 focus:ring-pink-500/10"
              placeholder="0.00"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">SST</span>
          </div>
          <button
            onClick={handleWithdraw}
            disabled={loading !== null || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > parseFloat(vaultBalance)}
            className="btn-secondary min-w-[140px] py-3 text-pink-400 border-pink-500/20 hover:bg-pink-500/10 transition-all"
          >
            {loading === 'withdraw' ? <Loader2 className="animate-spin h-5 w-5" /> : 'Withdraw'}
          </button>
        </div>
      </div>

      <div className="h-px bg-slate-700/50 my-6" />

      {/* Rewards Section */}
      <div className="relative overflow-hidden space-y-4 rounded-3xl bg-indigo-600/5 border border-indigo-500/20 p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-purple-500/10 blur-3xl" />
        
        <div className="relative z-10 text-center sm:text-left">
          <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest flex items-center justify-center sm:justify-start gap-2">
            <Sparkles className="h-4 w-4" />
            Accrued Yield
          </h3>
          <p className="text-5xl font-black text-white mt-1">
            {pendingRewards}
            <span className="ml-2 text-sm font-medium text-slate-500 uppercase">SST</span>
          </p>
        </div>
        <button
          onClick={handleClaim}
          disabled={loading !== null || parseFloat(pendingRewards) <= 0}
          className="relative z-10 btn-primary px-10 py-4 shadow-xl shadow-indigo-500/40 bg-indigo-500 hover:bg-indigo-400 border-none transition-all hover:scale-105 active:scale-95"
        >
          {loading === 'claim' ? <Loader2 className="animate-spin h-5 w-5" /> : 'Claim Rewards'}
        </button>
      </div>

    </div>
  );
}
