'use client';

import { useState } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { useContracts } from '@/hooks/useContracts';
import { CONTRACTS } from '@/lib/config';

type TokenAction = 'mint' | 'transfer' | 'burn';

export default function TokenPanel() {
  const { connected, publicKey, tokenABalance, tokenBBalance } = useWallet();
  const { mintToken, transferToken, burnToken, loading, error, clearError } = useContracts();

  const [selectedToken, setSelectedToken] = useState<'A' | 'B'>('A');
  const [action, setAction] = useState<TokenAction>('mint');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [txHash, setTxHash] = useState<string | null>(null);

  const contractId = selectedToken === 'A' ? CONTRACTS.TOKEN_A : CONTRACTS.TOKEN_B;
  const balance = selectedToken === 'A' ? tokenABalance : tokenBBalance;

  const handleSubmit = async () => {
    clearError();
    setTxHash(null);
    try {
      let hash = '';
      const amt = parseFloat(amount);

      if (action === 'mint') {
        const to = recipient || publicKey!;
        hash = await mintToken(contractId, to, amt);
      } else if (action === 'transfer') {
        if (!recipient) throw new Error('Recipient address required');
        hash = await transferToken(contractId, recipient, amt);
      } else if (action === 'burn') {
        hash = await burnToken(contractId, amt);
      }

      setTxHash(hash);
      setAmount('');
      setRecipient('');
    } catch {/* shown via hook */}
  };

  const actions: { id: TokenAction; label: string; icon: string; desc: string }[] = [
    { id: 'mint', label: 'Mint', icon: '🌱', desc: 'Create new tokens (enabled for testers)' },
    { id: 'transfer', label: 'Transfer', icon: '📤', desc: 'Send tokens to another address' },
    { id: 'burn', label: 'Burn', icon: '🔥', desc: 'Permanently destroy tokens' },
  ];

  return (
    <div className="space-y-4">

      {!CONTRACTS.TOKEN_A && !CONTRACTS.TOKEN_B && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-300">
          ⚠️ Set <code className="font-mono">NEXT_PUBLIC_TOKEN_A_CONTRACT</code> in <code className="font-mono">.env.local</code>
        </div>
      )}

      {/* Token selector */}
      <div className="flex rounded-xl border border-slate-700/50 bg-slate-900/40 p-1 gap-1">
        {(['A', 'B'] as const).map((t) => (
          <button
            key={t}
            id={`btn-token-${t}`}
            onClick={() => { setSelectedToken(t); setTxHash(null); }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
              selectedToken === t
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>{t === 'A' ? '🪙' : '💵'}</span>
            Token {t} ({t === 'A' ? 'SST' : 'USDC'})
          </button>
        ))}
      </div>

      {/* Balance */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
        <p className="text-sm text-slate-400">Your balance</p>
        <p className="text-3xl font-bold text-white mt-1">
          {balance} <span className="text-slate-500 text-lg">{selectedToken === 'A' ? 'SST' : 'USDC'}</span>
        </p>
        <div className="flex items-center justify-between mt-2">
           {contractId && (
             <p className="text-[10px] font-mono text-slate-600 truncate max-w-[200px]">Contract: {contractId}</p>
           )}
           {action === 'burn' && (
             <button
               className="text-[10px] uppercase font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
               onClick={() => setAmount(balance)}
             >
               Use Max
             </button>
           )}
        </div>
      </div>

      {/* Token info */}
      <div className="rounded-xl bg-indigo-500/5 border border-indigo-500/20 p-4 text-sm space-y-1">
        <p className="font-medium text-indigo-300">Contract Features</p>
        <p className="text-slate-400">✅ 0.3% transfer fee (distributed to admin/fee recipient)</p>
        <p className="text-slate-400">✅ Role-based minting (admin-only)</p>
        <p className="text-slate-400">✅ Allowance approval for pool interactions</p>
        <p className="text-slate-400">✅ ERC20-compatible via Soroban token interface</p>
      </div>

      {/* Action tabs */}
      <div className="flex gap-2">
        {actions.map((a) => (
          <button
            key={a.id}
            id={`btn-action-${a.id}`}
            onClick={() => { setAction(a.id); clearError(); setTxHash(null); }}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium transition-all ${
              action === a.id
                ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300'
                : 'border-slate-700/50 bg-slate-900/30 text-slate-400 hover:border-slate-600'
            }`}
          >
            <span className="text-lg">{a.icon}</span>
            {a.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-500 -mt-2">
        {actions.find((a) => a.id === action)?.desc}
      </p>

      {/* Amount input */}
      <div>
        <label className="mb-1.5 block text-sm text-slate-400">Amount</label>
        <input
          id="input-token-amount"
          type="number"
          min="0"
          step="any"
          placeholder="0.0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="input-field"
        />
      </div>

      {/* Recipient (mint/transfer) */}
      {(action === 'mint' || action === 'transfer') && (
        <div>
          <label className="mb-1.5 block text-sm text-slate-400">
            {action === 'mint' ? 'Recipient Address (leave blank for self)' : 'Recipient Address *'}
          </label>
          <input
            id="input-token-recipient"
            type="text"
            placeholder="G..."
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="input-field font-mono text-xs"
          />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {txHash && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-300">
          ✅ Success!{' '}
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

      <button
        id="btn-token-submit"
        onClick={handleSubmit}
        disabled={!connected || !contractId || loading || !amount || parseFloat(amount) <= 0}
        className={action === 'burn' ? 'btn-danger w-full py-4' : 'btn-primary w-full py-4'}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="spinner" /> Processing…
          </span>
        ) : !connected ? (
          'Connect Wallet'
        ) : (
          `${actions.find((a) => a.id === action)?.label} ${
            selectedToken === 'A' ? 'SST' : 'USDC'
          }`
        )}
      </button>
    </div>
  );
}
