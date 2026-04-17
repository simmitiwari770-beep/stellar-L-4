'use client';

import { useWallet } from '@/contexts/WalletContext';
import { EXPLORER_URL } from '@/lib/config';
import { formatDistanceToNow } from 'date-fns';

const TYPE_ICONS: Record<string, string> = {
  mint: '🌱',
  transfer: '📤',
  swap: '🔄',
  add_liquidity: '💧',
  remove_liquidity: '💸',
  approve: '✅',
};

const TYPE_LABELS: Record<string, string> = {
  mint: 'Mint',
  transfer: 'Transfer',
  swap: 'Swap',
  add_liquidity: 'Add Liquidity',
  remove_liquidity: 'Remove Liquidity',
  approve: 'Approve',
};

export default function TransactionHistory() {
  const { transactions } = useWallet();

  if (transactions.length === 0) {
    return (
      <div className="card py-20 text-center">
        <p className="text-4xl mb-4">📋</p>
        <p className="text-lg font-semibold text-white">No Transactions Yet</p>
        <p className="text-slate-400 mt-1 text-sm">
          Your transaction history will appear here once you start interacting with the contracts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Transaction History</h2>
        <span className="badge-success">{transactions.length} txns</span>
      </div>

      <div className="space-y-3">
        {transactions.map((tx) => (
          <div key={tx.id} className="card glass-hover">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800/60 text-lg">
                  {TYPE_ICONS[tx.type] || '📄'}
                </div>
                <div>
                  <p className="font-semibold text-white">{TYPE_LABELS[tx.type] || tx.type}</p>
                  {tx.hash ? (
                    <a
                      href={`${EXPLORER_URL}/tx/${tx.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      {tx.hash.slice(0, 8)}…{tx.hash.slice(-6)}
                    </a>
                  ) : (
                    <span className="text-xs text-slate-500">Pending…</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                {tx.status === 'pending' && (
                  <span className="badge-pending">
                    <span className="spinner h-2 w-2" />
                    Pending
                  </span>
                )}
                {tx.status === 'success' && (
                  <span className="badge-success">✓ Success</span>
                )}
                {tx.status === 'failed' && (
                  <span className="badge-failed">✗ Failed</span>
                )}
                <span className="text-xs text-slate-500">
                  {formatDistanceToNow(tx.timestamp, { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
