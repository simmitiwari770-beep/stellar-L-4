'use client';

import { GITHUB_REPO, EXPLORER_URL, NETWORK, CONTRACTS } from '@/lib/config';

export default function Footer() {
  return (
    <footer className="border-t border-slate-800/50 mt-16">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-base">
                ⚡
              </div>
              <span className="gradient-text text-lg font-bold">SoroSwap</span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Production-grade DeFi on Stellar Soroban. Real contracts, real swaps, real yields.
            </p>
          </div>

          {/* Protocol */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Protocol</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <span className="text-slate-500">Network:</span>{' '}
                <span className="text-indigo-300 font-medium">{NETWORK}</span>
              </li>
              <li>
                <span className="text-slate-500">Swap fee:</span>{' '}
                <span className="text-slate-200">0.3%</span>
              </li>
              <li>
                <span className="text-slate-500">Token fee:</span>{' '}
                <span className="text-slate-200">0.3% transfer</span>
              </li>
              <li>
                <span className="text-slate-500">AMM:</span>{' '}
                <span className="text-slate-200">Constant product (x·y=k)</span>
              </li>
            </ul>
          </div>

          {/* Contracts */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Contracts</h3>
            <ul className="space-y-2 text-xs text-slate-400 font-mono">
              {[
                { label: 'SST Token', addr: CONTRACTS.TOKEN },
                { label: 'SoroVault', addr: CONTRACTS.VAULT },
              ].map((c) => (
                <li key={c.label}>
                  <span className="text-slate-500 not-italic text-xs font-sans">{c.label}: </span>
                  {c.addr ? (
                    <a
                      href={`${EXPLORER_URL}/contract/${c.addr}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      {c.addr.slice(0, 10)}…
                    </a>
                  ) : (
                    <span className="text-slate-600">Not deployed</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Resources</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              {[
                { label: '📦 GitHub Repository', href: GITHUB_REPO },
                { label: '🔍 Block Explorer', href: EXPLORER_URL },
                { label: '📖 Soroban Docs', href: 'https://developers.stellar.org/docs/smart-contracts' },
                { label: '🔗 Freighter Wallet', href: 'https://freighter.app' },
              ].map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-indigo-300 transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-800/50 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            © 2026 SoroSwap. Built on Stellar Soroban. Open source.
          </p>
          <div className="flex items-center gap-3">
            <a
              href={`${GITHUB_REPO}/actions`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              CI/CD Status
            </a>
            <a
              href="https://freighter.app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-slate-700/50 bg-slate-800/40 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              🔗 Freighter Required
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
