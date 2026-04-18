import { NextResponse } from 'next/server';
import {
  rpc as SorobanRpc,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Contract,
  Keypair,
  Address,
  nativeToScVal,
} from '@stellar/stellar-sdk';
import { CONTRACTS, NETWORK, NETWORKS } from '@/lib/config';

// Real testnet faucet: mints SST to requester using DEPLOYER_SECRET_KEY (server-side only).
// This is intended for demo/testnet only. Keep mint amount capped.

const RPC_URL = NETWORKS[NETWORK as keyof typeof NETWORKS].rpcUrl;
const TOKEN_CONTRACT = CONTRACTS.TOKEN;
const NETWORK_PASSPHRASE =
  NETWORK === 'MAINNET' ? Networks.PUBLIC : Networks.TESTNET;

const MINT_CAP_SST = 100; // 100 SST per request
const DECIMALS = 7;
const FACTOR = 10 ** DECIMALS;

export async function POST(req: Request) {
  try {
    if (!TOKEN_CONTRACT) {
      return NextResponse.json({ error: 'Token contract not configured' }, { status: 400 });
    }

    const secret = process.env.DEPLOYER_SECRET_KEY;
    if (!secret) {
      return NextResponse.json({ error: 'Faucet not configured' }, { status: 501 });
    }

    const body = await req.json().catch(() => ({}));
    const to = String(body?.to || '');
    const amount = Number(body?.amount ?? MINT_CAP_SST);

    if (!to.startsWith('G') || to.length < 20) {
      return NextResponse.json({ error: 'Invalid destination address' }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > MINT_CAP_SST) {
      return NextResponse.json({ error: `Amount must be 1-${MINT_CAP_SST} SST` }, { status: 400 });
    }

    const server = new SorobanRpc.Server(RPC_URL, { allowHttp: false });
    const adminKp = Keypair.fromSecret(secret);
    const adminAccount = await server.getAccount(adminKp.publicKey());

    const rawAmount = BigInt(Math.floor(amount * FACTOR));
    const contract = new Contract(TOKEN_CONTRACT);

    const tx = new TransactionBuilder(adminAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call('mint', new Address(to).toScVal(), nativeToScVal(rawAmount, { type: 'i128' }))
      )
      .setTimeout(60)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(sim)) {
      return NextResponse.json({ error: `Simulation failed: ${sim.error}` }, { status: 400 });
    }

    const prepared = SorobanRpc.assembleTransaction(tx, sim).build();
    prepared.sign(adminKp);

    const sent = await server.sendTransaction(prepared);
    if (sent.status === 'ERROR') {
      return NextResponse.json({ error: sent.errorResult || 'Transaction error' }, { status: 400 });
    }

    return NextResponse.json({ hash: sent.hash, status: sent.status });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Faucet error' }, { status: 500 });
  }
}

