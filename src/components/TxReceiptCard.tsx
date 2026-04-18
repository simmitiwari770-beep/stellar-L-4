'use client';

import { Copy, X } from 'lucide-react';
import { useState } from 'react';

export type TxReceipt = {
  kind: 'deposit' | 'withdraw' | 'claim' | 'faucet';
  hash: string;
  signer: string;
  amountSst: string;
  tokenContract: string;
  vaultContract: string;
  network: string;
  ledger?: number;
  confirmedAtIso: string;
  explorerUrl: string;
  /** Deposit uses approve + deposit; we record the final on-chain hash */
  note?: string;
};

type Props = {
  receipt: TxReceipt;
  onDismiss: () => void;
};

export default function TxReceiptCard({ receipt, onDismiss }: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  };

  const title =
    receipt.kind === 'deposit'
      ? 'Deposit receipt'
      : receipt.kind === 'withdraw'
        ? 'Withdraw receipt'
        : receipt.kind === 'claim'
          ? 'Claim rewards receipt'
          : 'Testnet SST (faucet) receipt';

  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/50 to-slate-950/80 p-5 shadow-lg shadow-emerald-900/20">
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
        aria-label="Dismiss receipt"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="pr-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400/90">On-chain receipt</p>
        <h4 className="mt-1 text-lg font-bold text-white">{title}</h4>
        <p className="mt-1 text-xs text-slate-400">
          Confirmed on {receipt.network}. Values come from your Freighter transaction — not placeholder data.
        </p>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Network</dt>
          <dd className="font-medium text-slate-200">{receipt.network}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Confirmed at (local)</dt>
          <dd className="font-mono text-xs text-slate-300">
            {new Date(receipt.confirmedAtIso).toLocaleString()}
          </dd>
        </div>
        {receipt.ledger != null && (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Ledger</dt>
            <dd className="font-mono text-slate-200">#{receipt.ledger.toLocaleString()}</dd>
          </div>
        )}
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Signer (Freighter)</dt>
          <dd className="break-all font-mono text-[11px] text-indigo-300">{receipt.signer}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Amount (SST)</dt>
          <dd className="text-lg font-bold text-white">{receipt.amountSst} SST</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Transaction hash</dt>
          <dd className="flex flex-wrap items-center gap-2 break-all font-mono text-[11px] text-emerald-200/90">
            {receipt.hash}
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300 hover:bg-emerald-500/20"
              onClick={() => copy('hash', receipt.hash)}
            >
              <Copy className="h-3 w-3" />
              {copied === 'hash' ? 'Copied' : 'Copy'}
            </button>
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">SST token contract</dt>
          <dd className="break-all font-mono text-[10px] text-slate-400">{receipt.tokenContract}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Vault contract</dt>
          <dd className="break-all font-mono text-[10px] text-slate-400">{receipt.vaultContract}</dd>
        </div>
      </dl>

      {receipt.note && <p className="mt-3 text-[11px] text-slate-500">{receipt.note}</p>}

      <a
        href={receipt.explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center justify-center rounded-xl bg-emerald-600/90 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500"
      >
        Open full receipt on Stellar Expert →
      </a>
    </div>
  );
}
