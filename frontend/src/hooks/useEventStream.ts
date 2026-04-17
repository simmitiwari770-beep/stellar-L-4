import { useEffect, useRef, useState, useCallback } from 'react';
import { getRecentEvents } from '@/lib/stellar';
import { CONTRACTS, POLLING_INTERVAL_MS } from '@/lib/config';

export interface ChainEvent {
  id: string;
  ledger: number;
  type: string;
  value: string | null;
  txHash: string;
  createdAt?: string;
  contractId: string;
}

export function useEventStream() {
  const [events, setEvents] = useState<ChainEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(true);
  const [lastLedger, setLastLedger] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchEvents = useCallback(async () => {
    const contractsToWatch = [CONTRACTS.TOKEN_A, CONTRACTS.TOKEN_B, CONTRACTS.POOL].filter(Boolean);
    if (!contractsToWatch.length) return;

    try {
      const { events: evts, latestLedger } = await getRecentEvents(contractsToWatch, 50);
      
      if (latestLedger > 0) {
        const sorted = evts.sort((a, b) => b.ledger - a.ledger);
        setEvents(sorted as any);
        setLastLedger(latestLedger);
      }
    } catch (e: any) {
      console.warn('Event stream error:', e?.message || e);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEvents();
    timerRef.current = setInterval(fetchEvents, POLLING_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsStreaming(false);
    };
  }, [fetchEvents]);

  return { events, isStreaming, lastLedger, refresh: fetchEvents };
}
