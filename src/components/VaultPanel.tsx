'use client';

import { useState, useEffect, useMemo } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { Loader2, ArrowDownCircle, ArrowUpCircle, Sparkles, Wallet, Copy } from 'lucide-react';
import { signTransaction } from '@stellar/freighter-api';
import { Address, nativeToScVal, StrKey } from '@stellar/stellar-sdk';
import { CONTRACTS, TOKEN_FACTOR, EXPLORER_URL, NETWORK } from '@/lib/config';
import TxReceiptCard, { type TxReceipt } from '@/components/TxReceiptCard';
import { 
  buildContractCallXdr,
  sendPreparedTransaction,
  waitForTransaction,
  getLatestLedger,
  getNetworkPassphrase,
} from '@/lib/stellar';

function isTxSuccess(status: string | undefined): boolean {
  return String(status ?? '').toUpperCase() === 'SUCCESS';
}

function parseSstAmount(s: string): number {
  const n = Number.parseFloat(String(s).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function ledgerFromRpc(res: unknown): number | undefined {
  const r = res as { ledger?: number };
  return typeof r.ledger === 'number' ? r.ledger : undefined;
}

export default function VaultPanel() {
  const {
    connected,
    publicKey,
    refreshBalances,
    vaultBalance,
    pendingRewards,
    addTransaction,
    updateTransaction,
    tokenBalance,
  } = useWallet();
  
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<TxReceipt | null>(null);
  /** Must match Freighter public key — Soroban vault requires user.require_auth() on this address */
  const [depositSignerAddress, setDepositSignerAddress] = useState('');
  const depositValue = parseFloat(depositAmount || '0');
  const walletTokenValue = parseFloat(tokenBalance || '0');
  const hasEnoughWalletBalanceForDeposit = depositValue <= walletTokenValue;
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (publicKey) {
      setDepositSignerAddress(publicKey);
    }
  }, [publicKey]);

  const pendingRewardNum = useMemo(() => parseSstAmount(pendingRewards), [pendingRewards]);
  const vaultBalNum = useMemo(() => parseSstAmount(vaultBalance), [vaultBalance]);

  const copyText = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      setCopiedField(null);
    }
  };

  const requestTestTokens = async () => {
    if (!publicKey || !CONTRACTS.TOKEN) return;
    setError(null);
    setTxHash(null);
    setReceipt(null);
    setFaucetLoading(true);
    const passphrase = getNetworkPassphrase();

    const tryOnChainDrip = async (): Promise<{ hash: string; ledger?: number }> => {
      const dripXdr = await buildContractCallXdr(publicKey, CONTRACTS.TOKEN, 'claim_testnet_drip', [
        new Address(publicKey).toScVal(),
      ]);
      const signed = await signTransaction(dripXdr, { networkPassphrase: passphrase });
      if (signed.error) {
        throw new Error(signed.error);
      }
      const res = await sendPreparedTransaction(signed.signedTxXdr);
      if (res.status !== 'PENDING') {
        throw new Error(`Drip failed: ${res.status} ${res.errorResult || ''}`);
      }
      const final = await waitForTransaction(res.hash);
      return { hash: res.hash, ledger: ledgerFromRpc(final) };
    };

    const tryServerFaucet = async (): Promise<string | undefined> => {
      const res = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: publicKey, amount: 100 }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || `Faucet HTTP ${res.status}`);
      }
      return json?.hash ? String(json.hash) : undefined;
    };

    try {
      let hash: string | undefined;
      let ledgerHint: number | undefined;
      try {
        const drip = await tryOnChainDrip();
        hash = drip.hash;
        ledgerHint = drip.ledger;
      } catch (dripErr: any) {
        try {
          hash = await tryServerFaucet();
        } catch (apiErr: any) {
          const d = dripErr?.message || String(dripErr);
          const a = apiErr?.message || String(apiErr);
          throw new Error(
            `Could not mint test SST. Signed drip failed (${d}). API faucet failed (${a}). ` +
              `Redeploy the token from this repo (WASM includes claim_testnet_drip) and set NEXT_PUBLIC_TOKEN_CONTRACT + NEXT_PUBLIC_VAULT_CONTRACT on Vercel, ` +
              `or set DEPLOYER_SECRET_KEY (token admin) for /api/faucet. See README.`
          );
        }
      }
      if (hash && publicKey) {
        setTxHash(hash);
        setReceipt({
          kind: 'faucet',
          hash,
          signer: publicKey,
          amountSst: '100',
          tokenContract: CONTRACTS.TOKEN,
          vaultContract: CONTRACTS.VAULT,
          network: NETWORK,
          ledger: ledgerHint,
          confirmedAtIso: new Date().toISOString(),
          explorerUrl: `${EXPLORER_URL}/tx/${hash}`,
          note: 'Testnet drip mints SST to your wallet. Final balances update from RPC.',
        });
      }
      await refreshBalances();
    } catch (e: any) {
      setError(e?.message || 'Faucet failed');
    } finally {
      setFaucetLoading(false);
    }
  };

  const handleDeposit = async () => {
    setError(null);
    setTxHash(null);
    setReceipt(null);
    if (!connected || !publicKey || !CONTRACTS.VAULT || !CONTRACTS.TOKEN) return;
    let historyHash: string | null = null;
    try {
      const signer = depositSignerAddress.trim();
      if (!signer) {
        throw new Error('Enter the Stellar address that will sign this deposit (your Freighter account).');
      }
      if (!StrKey.isValidEd25519PublicKey(signer)) {
        throw new Error('Invalid Stellar address: use a public key starting with G (56 characters).');
      }
      if (signer !== publicKey) {
        throw new Error(
          'This address must match your currently connected Freighter account. Open the Freighter extension, switch to the account you want, reconnect here, then the field will stay in sync — or paste the same key as under Connected.'
        );
      }
      if (!depositAmount || Number.isNaN(depositValue) || depositValue <= 0) {
        throw new Error('Enter a valid deposit amount');
      }
      if (!hasEnoughWalletBalanceForDeposit) {
        throw new Error('Insufficient wallet balance for deposit');
      }

      setLoading('deposit');
      const amountNative = BigInt(Math.floor(depositValue * TOKEN_FACTOR));
      const currentLedger = await getLatestLedger();
      const expirationLedger = currentLedger.sequence + 5000;
      
      if (!CONTRACTS.TOKEN || !CONTRACTS.VAULT) {
        throw new Error('Contract addresses not configured');
      }

      const passphrase = getNetworkPassphrase();

      // Soroban transaction simulation currently expects one contract operation.
      // Execute approve and deposit as two deterministic sequential transactions.
      const approveXdr = await buildContractCallXdr(signer, CONTRACTS.TOKEN, 'approve', [
        new Address(signer).toScVal(),
        new Address(CONTRACTS.VAULT).toScVal(),
        nativeToScVal(amountNative, { type: 'i128' }),
        nativeToScVal(expirationLedger, { type: 'u32' }),
      ]);
      const signedApprove = await signTransaction(approveXdr, { networkPassphrase: passphrase });
      if (signedApprove.error) {
        throw new Error(signedApprove.error);
      }
      const approveRes = await sendPreparedTransaction(signedApprove.signedTxXdr);
      if (approveRes.status !== 'PENDING') {
        throw new Error(`Approve failed: ${approveRes.status} ${approveRes.errorResult || ''}`);
      }
      await waitForTransaction(approveRes.hash);

      const depositXdr = await buildContractCallXdr(signer, CONTRACTS.VAULT, 'deposit', [
        new Address(signer).toScVal(),
        nativeToScVal(amountNative, { type: 'i128' }),
      ]);
      const signedDeposit = await signTransaction(depositXdr, { networkPassphrase: passphrase });
      if (signedDeposit.error) {
        throw new Error(signedDeposit.error);
      }
      const depositRes = await sendPreparedTransaction(signedDeposit.signedTxXdr);
      
      if (depositRes.status !== 'PENDING') {
        console.error('Atomic Deposit failed RPC Response:', depositRes);
        throw new Error(`Atomic Deposit failed: ${depositRes.status} ${depositRes.errorResult || ''}`);
      }
      
      historyHash = depositRes.hash;
      addTransaction({
        id: depositRes.hash,
        hash: depositRes.hash,
        type: 'deposit',
        status: 'pending',
        amount: depositAmount,
        timestamp: Date.now(),
        explorerUrl: `${EXPLORER_URL}/tx/${depositRes.hash}`,
      });
      
      const depositFinal = await waitForTransaction(depositRes.hash);
      const depositOk = isTxSuccess(depositFinal.status);
      updateTransaction(depositRes.hash, {
        status: depositOk ? 'success' : 'failed',
      });
      if (!depositOk) {
        throw new Error(
          `Deposit did not succeed on-chain (${depositFinal.status || 'unknown'}). See explorer for details.`
        );
      }

      const lg = ledgerFromRpc(depositFinal);
      setReceipt({
        kind: 'deposit',
        hash: depositRes.hash,
        signer: signer,
        amountSst: depositAmount,
        tokenContract: CONTRACTS.TOKEN,
        vaultContract: CONTRACTS.VAULT,
        network: NETWORK,
        ledger: lg,
        confirmedAtIso: new Date().toISOString(),
        explorerUrl: `${EXPLORER_URL}/tx/${depositRes.hash}`,
        note:
          'Includes a separate approve transaction immediately before this deposit. Both are signed with Freighter.',
      });
      setTxHash(depositRes.hash);
      setDepositAmount('');
      try {
        await refreshBalances();
      } catch (refr: any) {
        console.warn('Balance refresh after deposit:', refr?.message || refr);
      }
    } catch (err: any) {
      console.error(err);
      if (historyHash) {
        updateTransaction(historyHash, { status: 'failed' });
      }
      setError(err.message || 'Deposit failed');
    } finally {
      setLoading(null);
    }
  };

  const handleWithdraw = async () => {
    setError(null);
    setTxHash(null);
    setReceipt(null);
    if (!connected || !publicKey || !CONTRACTS.VAULT) return;
    let historyHash: string | null = null;
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
      const passphrase = getNetworkPassphrase();
      
      const signedWithdraw = await signTransaction(withdrawXdr, { networkPassphrase: passphrase });
      if (signedWithdraw.error) {
        throw new Error(signedWithdraw.error);
      }
      const withdrawRes = await sendPreparedTransaction(signedWithdraw.signedTxXdr);
      
      if (withdrawRes.status !== 'PENDING') {
        console.error('Withdraw failed RPC Response:', withdrawRes);
        throw new Error(`Withdraw failed: ${withdrawRes.status} ${withdrawRes.errorResult || ''}`);
      }
      
      historyHash = withdrawRes.hash;
      addTransaction({
        id: withdrawRes.hash,
        hash: withdrawRes.hash,
        type: 'withdraw',
        status: 'pending',
        amount: withdrawAmount,
        timestamp: Date.now(),
        explorerUrl: `${EXPLORER_URL}/tx/${withdrawRes.hash}`,
      });
      
      const withdrawFinal = await waitForTransaction(withdrawRes.hash);
      const withdrawOk = isTxSuccess(withdrawFinal.status);
      updateTransaction(withdrawRes.hash, {
        status: withdrawOk ? 'success' : 'failed',
      });
      if (!withdrawOk) {
        throw new Error(
          `Withdraw did not succeed on-chain (${withdrawFinal.status || 'unknown'}). See explorer for details.`
        );
      }

      setReceipt({
        kind: 'withdraw',
        hash: withdrawRes.hash,
        signer: publicKey,
        amountSst: withdrawAmount,
        tokenContract: CONTRACTS.TOKEN,
        vaultContract: CONTRACTS.VAULT,
        network: NETWORK,
        ledger: ledgerFromRpc(withdrawFinal),
        confirmedAtIso: new Date().toISOString(),
        explorerUrl: `${EXPLORER_URL}/tx/${withdrawRes.hash}`,
      });
      setTxHash(withdrawRes.hash);
      setWithdrawAmount('');
      try {
        await refreshBalances();
      } catch (refr: any) {
        console.warn('Balance refresh after withdraw:', refr?.message || refr);
      }
    } catch (err: any) {
      console.error(err);
      if (historyHash) {
        updateTransaction(historyHash, { status: 'failed' });
      }
      setError(err.message || 'Withdraw failed');
    } finally {
      setLoading(null);
    }
  };

  const handleClaim = async () => {
    setError(null);
    setTxHash(null);
    setReceipt(null);
    if (!connected || !publicKey || !CONTRACTS.VAULT) return;
    let historyHash: string | null = null;
    try {
      if (!(pendingRewardNum > 0)) {
        throw new Error('No pending rewards to claim. Stake SST in the vault first; rewards accrue over time.');
      }
      setLoading('claim');
      const claimAmountLabel = pendingRewards;
      const claimXdr = await buildContractCallXdr(
        publicKey,
        CONTRACTS.VAULT,
        'claim_rewards',
        [
          new Address(publicKey).toScVal(),
        ]
      );
      const passphrase = getNetworkPassphrase();
      
      const signedClaim = await signTransaction(claimXdr, { networkPassphrase: passphrase });
      if (signedClaim.error) {
        throw new Error(signedClaim.error);
      }
      const claimRes = await sendPreparedTransaction(signedClaim.signedTxXdr);
      
      if (claimRes.status !== 'PENDING') {
        console.error('Claim failed RPC Response:', claimRes);
        throw new Error(`Claim failed: ${claimRes.status} ${claimRes.errorResult || ''}`);
      }
      
      historyHash = claimRes.hash;
      addTransaction({
        id: claimRes.hash,
        hash: claimRes.hash,
        type: 'claim',
        status: 'pending',
        amount: claimAmountLabel,
        timestamp: Date.now(),
        explorerUrl: `${EXPLORER_URL}/tx/${claimRes.hash}`,
      });
      
      const claimFinal = await waitForTransaction(claimRes.hash);
      const claimOk = isTxSuccess(claimFinal.status);
      updateTransaction(claimRes.hash, {
        status: claimOk ? 'success' : 'failed',
      });
      if (!claimOk) {
        throw new Error(
          `Claim did not succeed on-chain (${claimFinal.status || 'unknown'}). See explorer for details.`
        );
      }

      setReceipt({
        kind: 'claim',
        hash: claimRes.hash,
        signer: publicKey,
        amountSst: claimAmountLabel,
        tokenContract: CONTRACTS.TOKEN,
        vaultContract: CONTRACTS.VAULT,
        network: NETWORK,
        ledger: ledgerFromRpc(claimFinal),
        confirmedAtIso: new Date().toISOString(),
        explorerUrl: `${EXPLORER_URL}/tx/${claimRes.hash}`,
        note: 'Reward amount shown was pending at send time; final minted amount is on-chain.',
      });
      setTxHash(claimRes.hash);
      try {
        await refreshBalances();
      } catch (refr: any) {
        console.warn('Balance refresh after claim:', refr?.message || refr);
      }
    } catch (err: any) {
      console.error(err);
      if (historyHash) {
        updateTransaction(historyHash, { status: 'failed' });
      }
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
      {receipt ? (
        <TxReceiptCard
          receipt={receipt}
          onDismiss={() => {
            setReceipt(null);
            setTxHash(null);
          }}
        />
      ) : (
        txHash && (
          <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-300">
            ✅ Transaction submitted — waiting for receipt…{' '}
            <a
              href={`${EXPLORER_URL}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-green-200"
            >
              Explorer
            </a>
          </div>
        )
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
            onClick={() => setDepositAmount(tokenBalance)}
            className="text-[10px] font-bold text-indigo-400/70 hover:text-indigo-400 uppercase tracking-widest px-2 py-1 rounded-md bg-indigo-500/5 border border-indigo-500/10 transition-colors"
          >
            Use Max: {tokenBalance}
          </button>
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Deposit from address (must match Freighter)
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              spellCheck={false}
              className="input-field w-full font-mono text-xs"
              placeholder="G... (same as connected wallet)"
              value={depositSignerAddress}
              onChange={(e) => setDepositSignerAddress(e.target.value)}
              autoComplete="off"
              aria-invalid={depositSignerAddress.trim() !== (publicKey ?? '')}
            />
            <button
              type="button"
              onClick={() => publicKey && setDepositSignerAddress(publicKey)}
              className="shrink-0 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-indigo-300 hover:bg-indigo-500/20"
            >
              Use connected
            </button>
          </div>
          <p className="mt-1 text-[10px] text-slate-500">
            Real on-chain rule: the vault only accepts a deposit when this address <strong className="text-slate-400">equals</strong> your
            Freighter signer. To use another account, switch it in Freighter — this field updates automatically.
          </p>
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
            disabled={
              loading !== null ||
              !depositAmount ||
              Number.isNaN(depositValue) ||
              depositValue <= 0 ||
              !hasEnoughWalletBalanceForDeposit ||
              depositSignerAddress.trim() !== (publicKey ?? '')
            }
            className="btn-primary min-w-[140px] py-3 shadow-lg shadow-indigo-500/20"
          >
            {loading === 'deposit' ? (
              <Loader2 className="animate-spin h-5 w-5" />
            ) : depositSignerAddress.trim() !== (publicKey ?? '') ? (
              'Address ≠ Freighter'
            ) : !hasEnoughWalletBalanceForDeposit ? (
              'Insufficient Balance'
            ) : (
              'Deposit Now'
            )}
          </button>
        </div>
        <p className="text-[10px] leading-relaxed text-slate-500">
          Deposits credit the vault balance for the <span className="font-semibold text-slate-400">signer address</span> above
          (Soroban <code className="text-slate-400">require_auth</code>).
        </p>
        <div className="rounded-xl border border-slate-700/40 bg-slate-950/40 p-3 space-y-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
            Protocol contract IDs (copy for explorers / env)
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="min-w-0 flex-1">
              <span className="text-[9px] text-slate-500">SST token</span>
              <div className="flex items-center gap-1.5">
                <code className="truncate text-[10px] text-indigo-300/90">{CONTRACTS.TOKEN}</code>
                <button
                  type="button"
                  aria-label="Copy token contract id"
                  className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                  onClick={() => copyText('token', CONTRACTS.TOKEN)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                {copiedField === 'token' && <span className="text-[9px] text-emerald-400">Copied</span>}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[9px] text-slate-500">Vault</span>
              <div className="flex items-center gap-1.5">
                <code className="truncate text-[10px] text-pink-300/90">{CONTRACTS.VAULT}</code>
                <button
                  type="button"
                  aria-label="Copy vault contract id"
                  className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                  onClick={() => copyText('vault', CONTRACTS.VAULT)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                {copiedField === 'vault' && <span className="text-[9px] text-emerald-400">Copied</span>}
              </div>
            </div>
          </div>
        </div>
        {walletTokenValue <= 0 && (
          <button
            onClick={requestTestTokens}
            disabled={faucetLoading || loading !== null}
            className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-50"
          >
            {faucetLoading ? 'Requesting 100 SST…' : 'Get 100 SST Test Tokens (Testnet Faucet)'}
          </button>
        )}
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
        <div className="relative z-10 flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
          <button
            type="button"
            onClick={handleClaim}
            disabled={loading !== null || !(pendingRewardNum > 0)}
            className="btn-primary px-10 py-4 shadow-xl shadow-indigo-500/40 bg-indigo-500 hover:bg-indigo-400 border-none transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading === 'claim' ? <Loader2 className="animate-spin h-5 w-5" /> : 'Claim Rewards'}
          </button>
          {vaultBalNum > 0 && !(pendingRewardNum > 0) && (
            <p className="max-w-[280px] text-center text-[10px] leading-snug text-slate-500 sm:text-right">
              Rewards accrue while SST stays in the vault. Check again after a short wait.
            </p>
          )}
          {vaultBalNum <= 0 && (
            <p className="max-w-[280px] text-center text-[10px] text-slate-500 sm:text-right">Deposit SST first to earn rewards.</p>
          )}
        </div>
      </div>

    </div>
  );
}
