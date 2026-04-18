'use client';

import { useState } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { buildContractCallXdr, simulateAndSend, waitForTransaction } from '@/lib/stellar';
import { CONTRACTS, TOKEN_FACTOR, EXPLORER_URL } from '@/lib/config';
import { Address, nativeToScVal } from '@stellar/stellar-sdk';
import { Loader2 } from 'lucide-react';

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
      const currentLedger = await require('@/lib/stellar').getLatestLedger();
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
      
      const signedApprove = await require('@stellar/freighter-api').signTransaction(approveXdr, { network: "TESTNET" });
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
      
      const signedDeposit = await require('@stellar/freighter-api').signTransaction(depositXdr, { network: "TESTNET" });
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
      
      const signedWithdraw = await require('@stellar/freighter-api').signTransaction(withdrawXdr, { network: "TESTNET" });
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
      
      const signedClaim = await require('@stellar/freighter-api').signTransaction(claimXdr, { network: "TESTNET" });
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
      <div className="flex min-h-[300px] flex-col items-center justify-center space-y-4 rounded-2xl bg-slate-800/20 p-8 text-center border border-slate-700/50">
        <div className="text-5xl">🔗</div>
        <h3 className="text-xl font-bold text-white">Wallet Not Connected</h3>
        <p className="max-w-xs text-sm text-slate-400">
          Connect your Freighter wallet to deposit tokens and start earning rewards.
        </p>
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
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-indigo-400">📥</span> Deposit Tokens
        </h3>
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            className="input-field flex-1"
            placeholder="Amount to deposit"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
          />
          <button
            onClick={handleDeposit}
            disabled={loading !== null || !depositAmount || parseFloat(depositAmount) <= 0}
            className="btn-primary min-w-[120px] flex items-center justify-center"
          >
            {loading === 'deposit' ? <Loader2 className="animate-spin h-5 w-5" /> : 'Deposit'}
          </button>
        </div>
      </div>

      <div className="h-px bg-slate-700/50 my-6" />

      {/* Withdraw Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-pink-400">📤</span> Withdraw Tokens
        </h3>
        <div className="text-xs text-slate-400 mb-2">
          Available to withdraw: <span className="text-white font-bold">{vaultBalance}</span>
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            max={vaultBalance}
            className="input-field flex-1"
            placeholder="Amount to withdraw"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
          />
          <button
            onClick={handleWithdraw}
            disabled={loading !== null || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > parseFloat(vaultBalance)}
            className="btn-secondary text-pink-400 border-pink-400/30 hover:bg-pink-400/10 hover:border-pink-400/50 min-w-[120px] flex items-center justify-center"
          >
            {loading === 'withdraw' ? <Loader2 className="animate-spin h-5 w-5" /> : 'Withdraw'}
          </button>
        </div>
      </div>

      <div className="h-px bg-slate-700/50 my-6" />

      {/* Rewards Section */}
      <div className="space-y-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-yellow-400">✨</span> Pending Rewards
          </h3>
          <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600 mt-2">
            {pendingRewards}
          </p>
        </div>
        <button
          onClick={handleClaim}
          disabled={loading !== null || parseFloat(pendingRewards) <= 0}
          className="btn-primary min-w-[120px] flex items-center justify-center bg-gradient-to-r from-yellow-500 to-yellow-600 shadow-[0_0_15px_rgba(234,179,8,0.3)] hover:shadow-[0_0_25px_rgba(234,179,8,0.5)] border-none text-slate-900"
        >
          {loading === 'claim' ? <Loader2 className="animate-spin h-5 w-5" /> : 'Claim'}
        </button>
      </div>

    </div>
  );
}
