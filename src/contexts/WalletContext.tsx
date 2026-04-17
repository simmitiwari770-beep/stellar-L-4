'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  checkFreighterInstalled,
  connectFreighter,
  getWalletPublicKey,
  getWalletNetwork,
  watchWalletChanges,
} from '@/lib/freighter';
import {
  getTokenBalance,
  getLpBalance,
  getPoolReserves,
  getLatestLedger,
  type PoolReserves,
} from '@/lib/stellar';
import { CONTRACTS, POLLING_INTERVAL_MS } from '@/lib/config';

export interface TxRecord {
  id: string;
  hash: string;
  type: 'mint' | 'transfer' | 'swap' | 'add_liquidity' | 'remove_liquidity' | 'approve';
  status: 'pending' | 'success' | 'failed';
  amount?: string;
  timestamp: number;
  explorerUrl?: string;
}

interface WalletContextType {
  connected: boolean;
  publicKey: string | null;
  network: string | null;
  freighterInstalled: boolean;
  isConnecting: boolean;
  tokenABalance: string;
  tokenBBalance: string;
  lpBalance: string;
  poolReserves: PoolReserves;
  transactions: TxRecord[];
  ledger: number;
  connect: () => Promise<void>;
  disconnect: () => void;
  addTransaction: (tx: TxRecord) => void;
  updateTransaction: (id: string, update: Partial<TxRecord>) => void;
  refreshBalances: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [freighterInstalled, setFreighterInstalled] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [tokenABalance, setTokenABalance] = useState('0.0000');
  const [tokenBBalance, setTokenBBalance] = useState('0.0000');
  const [lpBalance, setLpBalance] = useState('0.0000');
  const [poolReserves, setPoolReserves] = useState<PoolReserves>({
    reserve_a: '0',
    reserve_b: '0',
    total_lp: '0',
  });
  const [transactions, setTransactions] = useState<TxRecord[]>([]);
  const [ledger, setLedger] = useState(0);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Check if Freighter is installed on mount
  useEffect(() => {
    checkFreighterInstalled().then(setFreighterInstalled).catch(() => setFreighterInstalled(false));
    // Try to restore session
    getWalletPublicKey().then((key) => {
      if (key) {
        setPublicKey(key);
        setConnected(true);
      }
    });
    getWalletNetwork().then((n) => {
      if (n) setNetwork(n);
    });
  }, []);

  // Watch for wallet changes
  useEffect(() => {
    if (!connected) return;
    const stop = watchWalletChanges(
      (addr) => {
        setPublicKey(addr);
      },
      (net) => {
        setNetwork(net);
      }
    );
    return stop;
  }, [connected]);

  const refreshBalances = useCallback(async () => {
    if (!publicKey) return;
    try {
      const [a, b, lp, reserves, lat] = await Promise.all([
        CONTRACTS.TOKEN_A ? getTokenBalance(CONTRACTS.TOKEN_A, publicKey) : Promise.resolve('0.0000'),
        CONTRACTS.TOKEN_B ? getTokenBalance(CONTRACTS.TOKEN_B, publicKey) : Promise.resolve('0.0000'),
        getLpBalance(publicKey),
        getPoolReserves(),
        getLatestLedger(),
      ]);
      setTokenABalance(a);
      setTokenBBalance(b);
      setLpBalance(lp);
      setPoolReserves(reserves);
      setLedger(lat.sequence);
    } catch (e: any) {
      console.warn('Balance refresh error:', e?.message || e);
    }
  }, [publicKey]);

  // Poll balances when connected
  useEffect(() => {
    if (!connected || !publicKey) return;
    refreshBalances();
    pollingRef.current = setInterval(refreshBalances, POLLING_INTERVAL_MS);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [connected, publicKey, refreshBalances]);

  const connect = async () => {
    setIsConnecting(true);
    try {
      const key = await connectFreighter();
      setPublicKey(key);
      setConnected(true);
      const net = await getWalletNetwork();
      setNetwork(net);
    } catch (err: any) {
      console.warn('Freighter connect error:', err?.message || err);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setConnected(false);
    setPublicKey(null);
    setTokenABalance('0.0000');
    setTokenBBalance('0.0000');
    setLpBalance('0.0000');
  };

  const addTransaction = (tx: TxRecord) => {
    setTransactions((prev) => [tx, ...prev].slice(0, 50));
  };

  const updateTransaction = (id: string, update: Partial<TxRecord>) => {
    setTransactions((prev) =>
      prev.map((tx) => (tx.id === id ? { ...tx, ...update } : tx))
    );
  };

  return (
    <WalletContext.Provider
      value={{
        connected,
        publicKey,
        network,
        freighterInstalled,
        isConnecting,
        tokenABalance,
        tokenBBalance,
        lpBalance,
        poolReserves,
        transactions,
        ledger,
        connect,
        disconnect,
        addTransaction,
        updateTransaction,
        refreshBalances,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
