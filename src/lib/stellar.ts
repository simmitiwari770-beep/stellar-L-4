import {
  rpc as SorobanRpc,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  xdr,
  Address,
  nativeToScVal,
  scValToNative,
  Contract,
  Keypair,
  Transaction,
} from '@stellar/stellar-sdk';
import { NETWORK, NETWORKS, CONTRACTS, TOKEN_FACTOR } from './config';

export interface CallParams {
  contractId: string;
  method: string;
  args: xdr.ScVal[];
}

const networkConfig = NETWORKS[NETWORK as keyof typeof NETWORKS];
const server = new SorobanRpc.Server(networkConfig.rpcUrl, { allowHttp: false });

// ─── Cache layer ──────────────────────────────────────────────────────────────
const cache = new Map<string, { value: unknown; ts: number }>();
const CACHE_TTL = 5000; // 5s

function fromCache<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.value as T;
  }
  return null;
}

function toCache(key: string, value: unknown) {
  cache.set(key, { value, ts: Date.now() });
}

// ─── RPC helpers ──────────────────────────────────────────────────────────────
export { server };

export async function getAccount(publicKey: string) {
  return server.getAccount(publicKey);
}

export function getNetworkPassphrase(): string {
  return networkConfig.networkPassphrase;
}

export function getNetworkConfig() {
  return networkConfig;
}

// ─── Simulate + send ──────────────────────────────────────────────────────────
export async function simulateAndSend(
  signedXdr: string
): Promise<SorobanRpc.Api.SendTransactionResponse> {
  const tx = TransactionBuilder.fromXDR(signedXdr, networkConfig.networkPassphrase) as Transaction;
  const simResult = await server.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation failed: ${simResult.error}`);
  }

  const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();
  const response = await server.sendTransaction(preparedTx);
  return response;
}

export async function sendPreparedTransaction(
  signedXdr: string
): Promise<SorobanRpc.Api.SendTransactionResponse> {
  const tx = TransactionBuilder.fromXDR(signedXdr, networkConfig.networkPassphrase) as Transaction;
  const response = await server.sendTransaction(tx);
  return response;
}

export async function waitForTransaction(
  txHash: string,
  maxAttempts = 50,
  intervalMs = 2500
): Promise<SorobanRpc.Api.GetTransactionResponse> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await server.getTransaction(txHash);
    if (response.status !== 'NOT_FOUND') {
      return response;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Transaction ${txHash} not found after ${maxAttempts} attempts`);
}

// ─── Contract calls (read-only) ───────────────────────────────────────────────
async function callContractView(
  contractId: string,
  method: string,
  args: xdr.ScVal[]
): Promise<xdr.ScVal> {
  // Use a reliable funded account for simulation
  const dummyAddress = 'GDTCBS3FUQECH6766JTTOPT5H52DINJ5T6MJ46RPTKB5QZNJWWVACKDC'; // Admin/Alice
  const account = await server.getAccount(dummyAddress).catch(() => ({ 
    accountId: () => dummyAddress,
    sequenceNumber: () => '1',
    incrementSequenceNumber: () => {}
  }));
  
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(account as any, {
    fee: BASE_FEE,
    networkPassphrase: networkConfig.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const result = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(result)) {
    console.warn(`View call [${method}] failed for ${contractId}:`, result.error);
    throw new Error(`View call failed: ${result.error}`);
  }
  if (!result.result) throw new Error('No result from simulation');
  return result.result.retval;
}

// ─── Token helpers ────────────────────────────────────────────────────────────
export async function getTokenBalance(
  contractId: string,
  walletAddress: string
): Promise<string> {
  try {
    const result = await callContractView(contractId, 'balance', [
      new Address(walletAddress).toScVal(),
    ]);
    const raw = scValToNative(result) as bigint;
    return (Number(raw) / TOKEN_FACTOR).toFixed(4);
  } catch (err) {
    console.warn(`Balance fetch failed for ${contractId}:`, err);
    return '0.0000';
  }
}

export async function getTokenSymbol(contractId: string): Promise<string> {
  try {
    const result = await callContractView(contractId, 'symbol', []);
    return scValToNative(result) as string;
  } catch {
    return '???';
  }
}

export async function getTokenDecimals(contractId: string): Promise<number> {
  try {
    const result = await callContractView(contractId, 'decimals', []);
    return Number(scValToNative(result));
  } catch {
    return 7;
  }
}

// ─── Vault helpers ─────────────────────────────────────────────────────────────
export async function getVaultBalance(walletAddress: string): Promise<string> {
  if (!CONTRACTS.VAULT) return '0';
  try {
    const result = await callContractView(CONTRACTS.VAULT, 'get_balance', [
      new Address(walletAddress).toScVal(),
    ]);
    const raw = scValToNative(result) as bigint;
    return (Number(raw) / TOKEN_FACTOR).toFixed(4);
  } catch {
    return '0';
  }
}

export async function getPendingRewards(walletAddress: string): Promise<string> {
  if (!CONTRACTS.VAULT) return '0';
  try {
    const result = await callContractView(CONTRACTS.VAULT, 'get_pending_rewards', [
      new Address(walletAddress).toScVal(),
    ]);
    const raw = scValToNative(result) as bigint;
    return (Number(raw) / TOKEN_FACTOR).toFixed(4);
  } catch {
    return '0';
  }
}

// ─── AMM & Liquidity helpers ──────────────────────────────────────────────────
export async function getPoolReserves() {
  if (!CONTRACTS.POOL) return { reserve_a: '0', reserve_b: '0', total_lp: '0' };
  try {
    const result = await callContractView(CONTRACTS.POOL, 'get_reserves', []);
    const native = scValToNative(result);
    // Assuming [resA, resB, totalLP] format
    return {
      reserve_a: (Number(native[0]) / TOKEN_FACTOR).toFixed(4),
      reserve_b: (Number(native[1]) / TOKEN_FACTOR).toFixed(4),
      total_lp: (Number(native[2]) / TOKEN_FACTOR).toFixed(4),
    };
  } catch {
    return { reserve_a: '0', reserve_b: '0', total_lp: '0' };
  }
}

export async function getSwapQuote(buyB: boolean, amountIn: number): Promise<number> {
  if (!CONTRACTS.POOL) return 0;
  try {
    const rawIn = BigInt(Math.floor(amountIn * TOKEN_FACTOR));
    const result = await callContractView(CONTRACTS.POOL, 'quote', [
      nativeToScVal(buyB, { type: 'bool' }),
      nativeToScVal(rawIn, { type: 'i128' }),
    ]);
    const rawOut = scValToNative(result) as bigint;
    return Number(rawOut) / TOKEN_FACTOR;
  } catch {
    return 0;
  }
}

export async function getLPBalance(walletAddress: string): Promise<string> {
  if (!CONTRACTS.POOL) return '0.0000';
  return getTokenBalance(CONTRACTS.POOL, walletAddress);
}

// ─── Build unsigned transaction XDR ──────────────────────────────────────────
export async function buildContractCallXdr(
  walletAddress: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[]
): Promise<string> {
  const account = await server.getAccount(walletAddress);
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: networkConfig.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(300)
    .build();

  // Simulate to get resource fees
  const simResult = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation error: ${simResult.error}`);
  }

  const prepared = SorobanRpc.assembleTransaction(tx, simResult).build();
  return prepared.toXDR();
}

export async function buildMultiCallXdr(
  walletAddress: string,
  calls: CallParams[]
): Promise<string> {
  const account = await server.getAccount(walletAddress);
  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: networkConfig.networkPassphrase,
  });

  for (const call of calls) {
    const contract = new Contract(call.contractId);
    builder.addOperation(contract.call(call.method, ...call.args));
  }

  const tx = builder
    .setTimeout(300)
    .build();

  // Simulate to get resource fees
  const simResult = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation error: ${simResult.error}`);
  }

  const prepared = SorobanRpc.assembleTransaction(tx, simResult).build();
  return prepared.toXDR();
}

// ─── Event streaming ──────────────────────────────────────────────────────────
export async function getRecentEvents(contractIds: string[], limit = 50, startLedger?: number) {
  try {
    const ledger = await server.getLatestLedger();
    // On first load read recent history, then poll incrementally.
    const effectiveStartLedger =
      typeof startLedger === 'number'
        ? Math.max(1, startLedger)
        : Math.max(1, ledger.sequence - 10_000);

    const filters = [
      {
        type: 'contract' as const,
        contractIds,
      },
    ];

    let response: Awaited<ReturnType<typeof server.getEvents>>;
    try {
      response = await server.getEvents({
        startLedger: effectiveStartLedger,
        filters,
        limit,
      });
    } catch (error: any) {
      const message = String(error?.message || '');
      const rangeMatch = message.match(/ledger range:\s*(\d+)\s*-\s*(\d+)/i);
      if (!rangeMatch) {
        throw error;
      }

      const minLedger = Number(rangeMatch[1]);
      const maxLedger = Number(rangeMatch[2]);
      const fallbackStartLedger = Math.min(Math.max(minLedger, effectiveStartLedger), maxLedger);

      response = await server.getEvents({
        startLedger: fallbackStartLedger,
        filters,
        limit,
      });
    }

    const events = response.events
      .map((e) => {
        try {
          // Soroban events from stellar-sdk return ScVal directly
          const topics = e.topic.map((t) => {
            try {
              return scValToNative(t as xdr.ScVal);
            } catch {
              return t.toString();
            }
          });

          let value: any = null;
          try {
            value = e.value ? scValToNative(e.value as xdr.ScVal) : null;
          } catch {
            value = e.value?.toString() || null;
          }

          const eventId = String(e.id);
          const contractId = String(e.contractId ?? '');
          const txHash = String(e.txHash ?? '');

          return {
            id: eventId,
            ledger: e.ledger,
            contractId,
            type: String(topics[0] || 'unknown'),
            value: value ? JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() : v)) : null,
            txHash,
          };
        } catch (err) {
          console.error('Error parsing individual event:', err);
          return null;
        }
      })
      .filter((evt): evt is any => evt !== null);

    return { events, latestLedger: ledger.sequence };
  } catch (err: any) {
    console.error('getRecentEvents global error:', err?.message || err);
    return { events: [], latestLedger: 0 };
  }
}

export async function getLatestLedger() {
  return server.getLatestLedger();
}

// ─── Friendbot ────────────────────────────────────────────────────────────────
export async function fundTestnetAccount(publicKey: string): Promise<void> {
  const url = `${NETWORKS.TESTNET.friendbotUrl}?addr=${publicKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Friendbot funding failed');
  }
}
