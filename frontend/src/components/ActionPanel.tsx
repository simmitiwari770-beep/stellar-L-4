'use client';

import * as Tabs from '@radix-ui/react-tabs';
import SwapPanel from './SwapPanel';
import LiquidityPanel from './LiquidityPanel';
import TokenPanel from './TokenPanel';

export default function ActionPanel() {
  return (
    <div className="card !p-0 overflow-hidden border-indigo-500/20 shadow-2xl shadow-indigo-500/10">
      <Tabs.Root defaultValue="swap" className="flex flex-col">
        <Tabs.List className="flex border-b border-slate-700/50 bg-slate-900/60 p-1">
          <Tabs.Trigger
            value="swap"
            className="flex-1 px-4 py-3 text-sm font-semibold text-slate-400 transition-all data-[state=active]:bg-indigo-500/10 data-[state=active]:text-indigo-400 rounded-lg hover:text-slate-200"
          >
            🔄 Swap
          </Tabs.Trigger>
          <Tabs.Trigger
            value="liquidity"
            className="flex-1 px-4 py-3 text-sm font-semibold text-slate-400 transition-all data-[state=active]:bg-indigo-500/10 data-[state=active]:text-indigo-400 rounded-lg hover:text-slate-200"
          >
            💧 Pool
          </Tabs.Trigger>
          <Tabs.Trigger
            value="token"
            className="flex-1 px-4 py-3 text-sm font-semibold text-slate-400 transition-all data-[state=active]:bg-indigo-500/10 data-[state=active]:text-indigo-400 rounded-lg hover:text-slate-200"
          >
            🪙 Tokens
          </Tabs.Trigger>
        </Tabs.List>

        <div className="p-6 overflow-y-auto max-h-[600px] custom-scrollbar">
          <Tabs.Content value="swap" className="outline-none focus:ring-0 animate-in fade-in duration-300">
            <SwapPanel />
          </Tabs.Content>
          
          <Tabs.Content value="liquidity" className="outline-none focus:ring-0 animate-in fade-in duration-300">
            <LiquidityPanel />
          </Tabs.Content>
          
          <Tabs.Content value="token" className="outline-none focus:ring-0 animate-in fade-in duration-300">
            <TokenPanel />
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  );
}
