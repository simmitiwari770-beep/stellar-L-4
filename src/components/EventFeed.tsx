'use client';

import { useEventStream } from '@/hooks/useEventStream';
import { EXPLORER_URL } from '@/lib/config';

export default function EventFeed() {
  const { events, isStreaming, lastLedger, refresh } = useEventStream();

  const getEventStyle = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('swap')) return { icon: '🔄', color: 'text-pink-400', bg: 'bg-pink-400/10', border: 'border-pink-500/20' };
    if (t.includes('mint')) return { icon: '🌱', color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-500/20' };
    if (t.includes('transfer')) return { icon: '📤', color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-500/20' };
    if (t.includes('liq')) return { icon: '💧', color: 'text-cyan-400', bg: 'bg-cyan-400/10', border: 'border-cyan-500/20' };
    if (t.includes('approve')) return { icon: '✅', color: 'text-indigo-400', bg: 'bg-indigo-400/10', border: 'border-indigo-500/20' };
    if (t.includes('init')) return { icon: '⚙️', color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-500/20' };
    return { icon: '⚡', color: 'text-slate-400', bg: 'bg-slate-400/10', border: 'border-slate-500/20' };
  };

  return (
    <div className="card h-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Live Events</h2>
          <p className="text-xs text-slate-400">Real-time Soroban contract events</p>
        </div>
        <div className="flex items-center gap-2">
          {isStreaming && (
            <div className="flex items-center gap-1.5 rounded-full bg-green-500/5 px-2 py-1 border border-green-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 pulse-glow" />
              <span className="text-[10px] uppercase tracking-wider font-bold text-green-400">Live</span>
            </div>
          )}
          <button
            onClick={refresh}
            className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {lastLedger > 0 && (
        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2 opacity-60">
          <span className="h-1 w-1 rounded-full bg-slate-500" />
          Scanning from ledger #{lastLedger.toLocaleString()}
        </div>
      )}

      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
        {events.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-12 h-12 bg-slate-800/40 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700/50">
              <p className="text-2xl">🔭</p>
            </div>
            <p className="text-sm font-medium text-slate-300">No events found</p>
            <p className="text-xs text-slate-500 max-w-[200px] mx-auto mt-2">
              Events will appear here when you interact with the contracts.
            </p>
          </div>
        ) : (
          events.map((evt) => {
            const style = getEventStyle(evt.type);
            return (
              <div
                key={evt.id}
                className={`rounded-xl border ${style.border} ${style.bg} p-3 text-xs animate-fade-in-up transition-all hover:scale-[1.01]`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-none">{style.icon}</span>
                    <span className={`font-bold uppercase tracking-tight ${style.color}`}>
                      {evt.type}
                    </span>
                  </div>
                  <a
                    href={`${EXPLORER_URL}/tx/${evt.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-slate-500 hover:text-indigo-400 font-mono transition-colors bg-slate-900/40 px-1.5 py-0.5 rounded"
                  >
                    <span>#</span>
                    {evt.ledger}
                  </a>
                </div>
                
                {evt.value && (
                  <div className="rounded-lg bg-slate-950/40 p-2 font-mono text-slate-400 break-all mb-2 border border-white/5">
                    {evt.value.slice(0, 80)}
                    {(evt.value?.length || 0) > 80 && '…'}
                  </div>
                )}
                
                <div className="flex items-center justify-between opacity-80">
                  <span className="text-slate-500 truncate max-w-[120px] font-mono text-[10px]">
                    ID: {evt.contractId.slice(0, 6)}…{evt.contractId.slice(-4)}
                  </span>
                  <a
                    href={`${EXPLORER_URL}/tx/${evt.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 font-mono text-[10px] flex items-center gap-1"
                  >
                    TX: {evt.txHash.slice(0, 6)}…
                    <span className="text-xs">↗</span>
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
