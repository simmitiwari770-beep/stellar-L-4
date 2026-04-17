'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { useContracts } from '@/hooks/useContracts';
import { getSwapQuote } from '@/lib/stellar';
import { CONTRACTS } from '@/lib/config';

function debounce<T extends (...args: any[]) => any>(fn: T, ms: number) {
  let timer: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export default function SwapPanel() {
  const { connected, publicKey, tokenABalance, tokenBBalance, poolReserves } = useWallet();
  const { swap, approveToken, mintToken, loading, error, clearError } = useContracts();

  const [sellA, setSellA] = useState(true); // true = sell A, buy B
  const [amountIn, setAmountIn] = useState('');
  const [quote, setQuote] = useState(0);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const priceImpact =
    quote > 0 && parseFloat(amountIn) > 0
      ? Math.abs(((parseFloat(amountIn) - quote) / parseFloat(amountIn)) * 100)
      : 0;

  // Debounced quote fetch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchQuote = useCallback(
    debounce(async (buyB: boolean, amount: number) => {
      if (!amount || amount <= 0) { setQuote(0); return; }
      setQuoteLoading(true);
      try {
        const q = await getSwapQuote(buyB, amount);
        setQuote(q);
      } catch { setQuote(0); }
      finally { setQuoteLoading(false); }
    }, 500),
    []
  );

  useEffect(() => {
    const val = parseFloat(amountIn);
    if (!isNaN(val) && val > 0) {
      fetchQuote(sellA, val);
    } else {
      setQuote(0);
    }
  }, [amountIn, sellA, fetchQuote]);

  const [step, setStep] = useState<'idle' | 'approving' | 'swapping'>('idle');

  const handleSwap = async () => {
    clearError();
    setTxHash(null);
    setStep('approving');
    try {
      const amount = parseFloat(amountIn);
      const tokenContract = sellA ? CONTRACTS.TOKEN_A! : CONTRACTS.TOKEN_B!;
      
      console.log('Step 1: Approving pool...');
      await approveToken(tokenContract, CONTRACTS.POOL!, amount);
      
      setStep('swapping');
      console.log('Step 2: Executing swap...');
      const hash = await swap(sellA, amount, quote);
      
      setTxHash(hash);
      setAmountIn('');
      setQuote(0);
    } catch (err: any) {
      console.warn('Swap failed:', err?.message || err);
    } finally {
      setStep('idle');
    }
  };

  const contractsSet = CONTRACTS.POOL && CONTRACTS.TOKEN_A && CONTRACTS.TOKEN_B;

  return (
    <div className="space-y-4">

      {!contractsSet && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-300">
          ⚠️ Deploy contracts and set addresses in <code className="font-mono">.env.local</code> to enable swaps.
        </div>
      )}

      {/* Sell */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-slate-400">You Sell</span>
          <span className="text-xs text-slate-500">
            Balance: {sellA ? tokenABalance : tokenBBalance}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <input
            id="input-amount-in"
            type="number"
            min="0"
            step="any"
            className="input-field flex-1 bg-transparent border-none px-0 text-2xl font-semibold"
            placeholder="0.0"
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
          />
          <div className="flex items-center gap-2 rounded-xl border border-slate-600/50 bg-slate-800 px-3 py-2">
            <span className="text-lg">{sellA ? '🪙' : '💵'}</span>
            <span className="text-sm font-semibold text-white">{sellA ? 'SST' : 'USDC'}</span>
          </div>
        </div>
        <button
          className="mt-2 text-xs text-indigo-400 hover:text-indigo-300"
          onClick={() => setAmountIn(sellA ? tokenABalance : tokenBBalance)}
        >
          Use max
        </button>
      </div>

      {/* Flip button */}
      <div className="flex justify-center">
        <button
          id="btn-flip-swap"
          onClick={() => { setSellA((v) => !v); setAmountIn(''); setQuote(0); }}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/10 text-xl transition-all hover:scale-110 hover:bg-indigo-500/25"
        >
          ↕️
        </button>
      </div>

      {/* Buy */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-slate-400">You Buy (estimated)</span>
          <span className="text-xs text-slate-500">
            Balance: {sellA ? tokenBBalance : tokenABalance}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 text-2xl font-semibold text-white">
            {quoteLoading ? (
              <span className="text-slate-500">…</span>
            ) : (
              <span>{quote > 0 ? quote.toFixed(6) : '0.0'}</span>
            )}
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-600/50 bg-slate-800 px-3 py-2">
            <span className="text-lg">{sellA ? '💵' : '🪙'}</span>
            <span className="text-sm font-semibold text-white">{sellA ? 'USDC' : 'SST'}</span>
          </div>
        </div>
      </div>

      {/* Swap details */}
      {quote > 0 && (
        <div className="rounded-xl bg-slate-900/40 p-4 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-400">Price impact</span>
            <span className={priceImpact > 2 ? 'text-red-400' : 'text-green-400'}>
              {priceImpact.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Protocol fee</span>
            <span className="text-slate-300">0.3%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Slippage tolerance</span>
            <span className="text-slate-300">0.5%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Min received</span>
            <span className="text-slate-300">{(quote * 0.995).toFixed(6)}</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="space-y-3">
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
          {error.toLowerCase().includes('balance') && (
            <button
               onClick={async () => {
                 try {
                   await mintToken(sellA ? CONTRACTS.TOKEN_A! : CONTRACTS.TOKEN_B!, publicKey!, 100);
                 } catch (e) {}
               }}
               className="w-full rounded-xl border border-green-500/30 bg-green-500/10 py-2 text-xs font-bold text-green-400 hover:bg-green-500/20 transition-all"
            >
              Get Free 100 {sellA ? 'SST' : 'USDC'} Tokens 🪙
            </button>
          )}
        </div>
      )}

      {/* Success */}
      {txHash && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-300">
          ✅ Swap confirmed!{' '}
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-green-200"
          >
            View transaction →
          </a>
        </div>
      )}

      {/* Swap button */}
      <button
        id="btn-swap-submit"
        onClick={handleSwap}
        disabled={!connected || !contractsSet || loading || !amountIn || parseFloat(amountIn) <= 0 || parseFloat(amountIn) > parseFloat(sellA ? tokenABalance : tokenBBalance)}
        className="btn-primary w-full py-4 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="spinner" /> 
            {step === 'approving' ? 'Approving Tokens...' : step === 'swapping' ? 'Finalizing Swap...' : 'Processing…'}
          </span>
        ) : !connected ? (
          'Connect Wallet'
        ) : parseFloat(amountIn || '0') > parseFloat(sellA ? tokenABalance : tokenBBalance) ? (
          'Insufficient Balance'
        ) : (
          `Swap ${sellA ? 'SST' : 'USDC'} for ${sellA ? 'USDC' : 'SST'}`
        )}
      </button>
    </div>
  );
}
