'use client';

import { useState } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { useContracts } from '@/hooks/useContracts';
import { CONTRACTS } from '@/lib/config';

export default function LiquidityPanel() {
  const { connected, tokenABalance, tokenBBalance, lpBalance, poolReserves } = useWallet();
  const { addLiquidity, removeLiquidity, approveToken, loading, error, clearError } = useContracts();

  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [lpAmount, setLpAmount] = useState('');
  const [txHash, setTxHash] = useState<string | null>(null);

  const contractsSet = CONTRACTS.POOL && CONTRACTS.TOKEN_A && CONTRACTS.TOKEN_B;

  // Auto-compute B when A changes (at current ratio)
  const handleAmountAChange = (val: string) => {
    setAmountA(val);
    const resA = parseFloat(poolReserves.reserve_a);
    const resB = parseFloat(poolReserves.reserve_b);
    if (resA > 0 && resB > 0 && val) {
      const computed = (parseFloat(val) * resB) / resA;
      setAmountB(isNaN(computed) ? '' : computed.toFixed(6));
    }
  };

  const hasEnoughA = parseFloat(tokenABalance) >= parseFloat(amountA || '0');
  const hasEnoughB = parseFloat(tokenBBalance) >= parseFloat(amountB || '0');

  const handleAdd = async () => {
    clearError();
    try {
      const valA = parseFloat(amountA);
      const valB = parseFloat(amountB);
      
      // Approve both tokens first
      if (CONTRACTS.POOL) {
        console.log('Step 1: Approving Token A...');
        await approveToken(CONTRACTS.TOKEN_A!, CONTRACTS.POOL, valA);
        console.log('Step 2: Approving Token B...');
        await approveToken(CONTRACTS.TOKEN_B!, CONTRACTS.POOL, valB);
      }
      
      console.log('Step 3: Adding liquidity...');
      const hash = await addLiquidity(valA, valB);
      setTxHash(hash);
      setAmountA('');
      setAmountB('');
    } catch (err: any) {
      console.error('Add liquidity failed:', err);
    }
  };

  const handleRemove = async () => {
    clearError();
    try {
      const hash = await removeLiquidity(parseFloat(lpAmount));
      setTxHash(hash);
      setLpAmount('');
    } catch { /* shown */ }
  };

  // Estimated withdrawal amounts
  const estA = lpAmount && parseFloat(lpAmount) > 0 && parseFloat(poolReserves.total_lp) > 0
    ? ((parseFloat(lpAmount) / parseFloat(poolReserves.total_lp)) * parseFloat(poolReserves.reserve_a)).toFixed(4)
    : '0';
  const estB = lpAmount && parseFloat(lpAmount) > 0 && parseFloat(poolReserves.total_lp) > 0
    ? ((parseFloat(lpAmount) / parseFloat(poolReserves.total_lp)) * parseFloat(poolReserves.reserve_b)).toFixed(4)
    : '0';

  return (
    <div className="space-y-4">
      {!contractsSet && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-300">
          ⚠️ Deploy contracts and configure <code className="font-mono">.env.local</code> to enable pooling.
        </div>
      )}

      {/* Pool info */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Reserve SST', value: poolReserves.reserve_a },
          { label: 'Reserve USDC', value: poolReserves.reserve_b },
          { label: 'Total LP', value: poolReserves.total_lp },
        ].map((item) => (
          <div key={item.label} className="rounded-xl bg-slate-900/50 p-3 text-center">
            <p className="text-xs text-slate-400 truncate">{item.label}</p>
            <p className="mt-1 text-base font-bold text-indigo-300">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Your LP */}
      <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
        <p className="text-sm text-slate-400">Your LP tokens</p>
        <p className="text-2xl font-bold text-green-400">{lpBalance}</p>
        {parseFloat(lpBalance) > 0 && parseFloat(poolReserves.total_lp) > 0 && (
          <p className="text-xs text-slate-500 mt-1">
            Pool share:{' '}
            {((parseFloat(lpBalance) / parseFloat(poolReserves.total_lp)) * 100).toFixed(4)}%
          </p>
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-xl border border-slate-700/50 bg-slate-900/40 p-1 gap-1">
        {(['add', 'remove'] as const).map((m) => (
          <button
            key={m}
            id={`btn-liquidity-${m}`}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              mode === m
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {m === 'add' ? '+ Add Liquidity' : '− Remove Liquidity'}
          </button>
        ))}
      </div>

      {mode === 'add' ? (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-slate-400">
              SST Amount <span className="text-slate-600">(Balance: {tokenABalance})</span>
            </label>
            <input
              id="input-liquidity-a"
              type="number"
              min="0"
              step="any"
              placeholder="0.0"
              value={amountA}
              onChange={(e) => handleAmountAChange(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-slate-400">
              USDC Amount <span className="text-slate-600">(Balance: {tokenBBalance})</span>
            </label>
            <input
              id="input-liquidity-b"
              type="number"
              min="0"
              step="any"
              placeholder="0.0"
              value={amountB}
              onChange={(e) => setAmountB(e.target.value)}
              className="input-field"
            />
          </div>
          <p className="text-xs text-slate-500">
            * Two approvals + one pool call will be signed. Total: 3 transactions.
          </p>
          <button
            id="btn-add-liquidity"
            onClick={handleAdd}
            disabled={!connected || !contractsSet || loading || !amountA || !amountB || !hasEnoughA || !hasEnoughB}
            className="btn-primary w-full py-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2"><span className="spinner" /> Processing…</span>
            ) : !connected ? (
              'Connect Wallet'
            ) : !hasEnoughA || !hasEnoughB ? (
              'Insufficient Balance'
            ) : (
              'Add Liquidity'
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-slate-400">
              LP Token Amount <span className="text-slate-600">(Balance: {lpBalance})</span>
            </label>
            <input
              id="input-lp-amount"
              type="number"
              min="0"
              step="any"
              placeholder="0.0"
              value={lpAmount}
              onChange={(e) => setLpAmount(e.target.value)}
              className="input-field"
            />
            <button
               className="mt-2 text-xs text-indigo-400 hover:text-indigo-300"
               onClick={() => setLpAmount(lpBalance)}
            >
              Use max
            </button>
          </div>
          {parseFloat(lpAmount) > 0 && (
            <div className="rounded-xl bg-slate-900/50 p-4 text-sm space-y-2">
              <p className="text-slate-400 font-medium">You will receive:</p>
              <div className="flex justify-between">
                <span className="text-slate-400">SST</span>
                <span className="text-white font-medium">{estA}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">USDC</span>
                <span className="text-white font-medium">{estB}</span>
              </div>
            </div>
          )}
          <button
            id="btn-remove-liquidity"
            onClick={handleRemove}
            disabled={!connected || !contractsSet || loading || !lpAmount || parseFloat(lpAmount) <= 0 || parseFloat(lpAmount) > parseFloat(lpBalance)}
            className="btn-danger w-full py-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2"><span className="spinner" /> Processing…</span>
            ) : parseFloat(lpAmount || '0') > parseFloat(lpBalance) ? (
              'Insufficient LP Balance'
            ) : (
              'Remove Liquidity'
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {txHash && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-300">
          ✅ Transaction confirmed!{' '}
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-green-200"
          >
            View on Explorer →
          </a>
        </div>
      )}
    </div>
  );
}
