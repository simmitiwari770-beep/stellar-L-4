import { useCallback, useState } from 'react';
import { Address, nativeToScVal, xdr, TransactionBuilder, rpc as SorobanRpc } from '@stellar/stellar-sdk';
import { useWallet } from '@/contexts/WalletContext';
import { buildContractCallXdr, waitForTransaction } from '@/lib/stellar';
import { signWithFreighter } from '@/lib/freighter';
import { getNetworkPassphrase } from '@/lib/stellar';
import { CONTRACTS, TOKEN_FACTOR, EXPLORER_URL, MAX_RETRIES, SLIPPAGE_BPS } from '@/lib/config';
import { v4 as uuid } from 'uuid';

type TxType = 'mint' | 'transfer' | 'swap' | 'add_liquidity' | 'remove_liquidity' | 'approve';

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries reached');
}

export function useContracts() {
  const { publicKey, addTransaction, updateTransaction, refreshBalances } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeContractCall = useCallback(
    async (
      contractId: string,
      method: string,
      args: xdr.ScVal[],
      type: TxType
    ): Promise<string> => {
      if (!publicKey) throw new Error('Wallet not connected');
      setLoading(true);
      setError(null);

      const txId = uuid();
      addTransaction({
        id: txId,
        hash: '',
        type,
        status: 'pending',
        timestamp: Date.now(),
      });

      try {
        const xdrTx = await withRetry(() =>
          buildContractCallXdr(publicKey, contractId, method, args)
        );

        const passphrase = getNetworkPassphrase();
        const signedXdr = await signWithFreighter(xdrTx, passphrase);

        const { server } = await import('@/lib/stellar');

        const prepTx = TransactionBuilder.fromXDR(
          signedXdr,
          passphrase
        );

        const sendResult = await server.sendTransaction(prepTx as any);

        if (sendResult.status === 'ERROR') {
          throw new Error(`Transaction failed: ${JSON.stringify(sendResult.errorResult)}`);
        }

        const txHash = sendResult.hash;
        const explorerUrl = `${EXPLORER_URL}/tx/${txHash}`;

        updateTransaction(txId, { hash: txHash, explorerUrl });

        // Wait for confirmation
        const finalResult = await waitForTransaction(txHash);
        const success = finalResult.status === 'SUCCESS';

        updateTransaction(txId, {
          status: success ? 'success' : 'failed',
        });

        if (!success) throw new Error('Transaction failed on chain');

        await refreshBalances();
        return txHash;
      } catch (err: any) {
        const msg = err?.message || 'Transaction failed';
        setError(msg);
        updateTransaction(txId, { status: 'failed' });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, addTransaction, updateTransaction, refreshBalances]
  );

  // ─── Token calls ────────────────────────────────────────────────

  const mintToken = useCallback(
    async (contractId: string, to: string, amount: number) => {
      const rawAmount = BigInt(Math.floor(amount * TOKEN_FACTOR));
      return executeContractCall(
        contractId,
        'mint',
        [new Address(to).toScVal(), nativeToScVal(rawAmount, { type: 'i128' })],
        'mint'
      );
    },
    [executeContractCall]
  );

  const transferToken = useCallback(
    async (contractId: string, to: string, amount: number) => {
      if (!publicKey) throw new Error('Not connected');
      const rawAmount = BigInt(Math.floor(amount * TOKEN_FACTOR));
      return executeContractCall(
        contractId,
        'transfer',
        [
          new Address(publicKey).toScVal(),
          new Address(to).toScVal(),
          nativeToScVal(rawAmount, { type: 'i128' }),
        ],
        'transfer'
      );
    },
    [executeContractCall, publicKey]
  );

  const burnToken = useCallback(
    async (contractId: string, amount: number) => {
      if (!publicKey) throw new Error('Not connected');
      const rawAmount = BigInt(Math.floor(amount * TOKEN_FACTOR));
      return executeContractCall(
        contractId,
        'burn',
        [new Address(publicKey).toScVal(), nativeToScVal(rawAmount, { type: 'i128' })],
        'transfer'
      );
    },
    [executeContractCall, publicKey]
  );

  const approveToken = useCallback(
    async (contractId: string, spender: string, amount: number) => {
      if (!publicKey) throw new Error('Not connected');
      
      // Get current ledger to set future expiration
      const { server } = await import('@/lib/stellar');
      const latestLedger = await server.getLatestLedger();
      const expirationLedger = latestLedger.sequence + 5000; // ~7 hours

      const rawAmount = BigInt(Math.floor(amount * TOKEN_FACTOR));
      return executeContractCall(
        contractId,
        'approve',
        [
          new Address(publicKey).toScVal(),
          new Address(spender).toScVal(),
          nativeToScVal(rawAmount, { type: 'i128' }),
          nativeToScVal(expirationLedger, { type: 'u32' }),
        ],
        'approve'
      );
    },
    [executeContractCall, publicKey]
  );

  // ─── Pool calls ─────────────────────────────────────────────────

  const addLiquidity = useCallback(
    async (amountA: number, amountB: number) => {
      if (!publicKey) throw new Error('Not connected');
      const rawA = BigInt(Math.floor(amountA * TOKEN_FACTOR));
      const rawB = BigInt(Math.floor(amountB * TOKEN_FACTOR));
      return executeContractCall(
        CONTRACTS.POOL,
        'add_liquidity',
        [
          new Address(publicKey).toScVal(),
          nativeToScVal(rawA, { type: 'i128' }),
          nativeToScVal(rawB, { type: 'i128' }),
        ],
        'add_liquidity'
      );
    },
    [executeContractCall, publicKey]
  );

  const removeLiquidity = useCallback(
    async (lpAmount: number) => {
      if (!publicKey) throw new Error('Not connected');
      const rawLp = BigInt(Math.floor(lpAmount * TOKEN_FACTOR));
      return executeContractCall(
        CONTRACTS.POOL,
        'remove_liquidity',
        [
          new Address(publicKey).toScVal(),
          nativeToScVal(rawLp, { type: 'i128' }),
        ],
        'remove_liquidity'
      );
    },
    [executeContractCall, publicKey]
  );

  const swap = useCallback(
    async (buyB: boolean, amountIn: number, minOut: number) => {
      if (!publicKey) throw new Error('Not connected');
      const rawIn = BigInt(Math.floor(amountIn * TOKEN_FACTOR));
      // Apply slippage tolerance
      const minOutWithSlippage = minOut * (1 - SLIPPAGE_BPS / 10000);
      const rawMin = BigInt(Math.floor(minOutWithSlippage * TOKEN_FACTOR));
      return executeContractCall(
        CONTRACTS.POOL,
        'swap',
        [
          new Address(publicKey).toScVal(),
          nativeToScVal(buyB, { type: 'bool' }),
          nativeToScVal(rawIn, { type: 'i128' }),
          nativeToScVal(rawMin, { type: 'i128' }),
        ],
        'swap'
      );
    },
    [executeContractCall, publicKey]
  );

  return {
    loading,
    error,
    mintToken,
    transferToken,
    burnToken,
    approveToken,
    addLiquidity,
    removeLiquidity,
    swap,
    clearError: () => setError(null),
  };
}
