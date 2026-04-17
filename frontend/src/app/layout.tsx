import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { WalletProvider } from '@/contexts/WalletContext';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'SoroSwap — Stellar DeFi Protocol',
  description:
    'A production-grade DeFi application built on Stellar Soroban. Swap tokens, provide liquidity, and earn fees — all on-chain.',
  keywords: ['Stellar', 'Soroban', 'DeFi', 'AMM', 'Liquidity Pool', 'Web3', 'Blockchain'],
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
  },
  openGraph: {
    title: 'SoroSwap — Stellar DeFi Protocol',
    description: 'Production DeFi on Stellar Soroban — real contracts, real swaps.',
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
