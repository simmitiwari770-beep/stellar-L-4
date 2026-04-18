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
  const seenIdsRef = useRef<Set<string>>(new Set());

  const fetchEvents = useCallback(async () => {
    const contractsToWatch = [CONTRACTS.TOKEN, CONTRACTS.VAULT].filter(Boolean);
    if (!contractsToWatch.length) return;

    try {
      const startFrom = lastLedger > 0 ? lastLedger + 1 : undefined;
      const { events: evts, latestLedger } = await getRecentEvents(contractsToWatch, 50, startFrom);
      
      if (latestLedger > 0) {
        const incoming = evts.filter((evt) => !seenIdsRef.current.has(evt.id));
        for (const evt of incoming) {
          seenIdsRef.current.add(evt.id);
        }
        const sorted = incoming.sort((a, b) => b.ledger - a.ledger) as ChainEvent[];
        setEvents((prev) => [...sorted, ...prev].slice(0, 200));
        setLastLedger(latestLedger);
      }
    } catch (e: any) {
      console.warn('Event stream error:', e?.message || e);
    }
  }, [lastLedger]);

  useEffect(() => {
    fetchEvents();
    timerRef.current = setInterval(fetchEvents, POLLING_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsStreaming(false);
    };
  }, [fetchEvents]);

  return { events, isStreaming, lastLedger, refresh: fetchEvents };
}
