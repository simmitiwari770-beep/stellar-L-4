// Contract addresses — set these after deploying to Stellar Testnet
// Run: stellar contract deploy --wasm target/wasm32-unknown-unknown/release/...
export const NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'TESTNET';

export const NETWORKS = {
  TESTNET: {
    networkPassphrase: 'Test SDF Network ; September 2015',
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://soroban-testnet.stellar.org',
    horizonUrl: process.env.NEXT_PUBLIC_HORIZON_URL || 'https://horizon-testnet.stellar.org',
    friendbotUrl: 'https://friendbot.stellar.org',
  },
  MAINNET: {
    networkPassphrase: 'Public Global Stellar Network ; September 2015',
    rpcUrl: 'https://mainnet.sorobanrpc.com',
    horizonUrl: 'https://horizon.stellar.org',
    friendbotUrl: null,
  },
} as const;

export const CONTRACTS = {
  TOKEN_A: process.env.NEXT_PUBLIC_TOKEN_A_CONTRACT || '',
  TOKEN_B: process.env.NEXT_PUBLIC_TOKEN_B_CONTRACT || '',
  POOL: process.env.NEXT_PUBLIC_POOL_CONTRACT || '',
};

export const TOKEN_DECIMALS = 7;
export const TOKEN_FACTOR = 10 ** TOKEN_DECIMALS;

export const POLLING_INTERVAL_MS = 6000; // ~1 ledger
export const MAX_RETRIES = 3;
export const SLIPPAGE_BPS = 50; // 0.5% default slippage

export const GITHUB_REPO = 'https://github.com/your-org/soroswap-defi';
export const EXPLORER_URL = 'https://stellar.expert/explorer/testnet';
