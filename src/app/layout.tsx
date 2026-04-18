import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { WalletProvider } from '@/contexts/WalletContext';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'SoroVault — Stellar Soroban Vault',
  description:
    'Production Soroban vault dApp on Stellar testnet: SST token, yield vault, Freighter wallet, real on-chain deposits and withdrawals.',
  keywords: ['Stellar', 'Soroban', 'Vault', 'DeFi', 'SST', 'Freighter', 'Web3', 'Blockchain'],
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
  },
  openGraph: {
    title: 'SoroVault — Stellar Soroban Vault',
    description: 'Real Soroban contracts: token + vault with inter-contract calls on Stellar testnet.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
