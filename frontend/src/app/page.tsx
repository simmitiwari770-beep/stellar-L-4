'use client';

import Navbar from '@/components/Navbar';
import Dashboard from '@/components/Dashboard';
import TransactionHistory from '@/components/TransactionHistory';
import EventFeed from '@/components/EventFeed';
import Footer from '@/components/Footer';
import ActionPanel from '@/components/ActionPanel';

export default function Home() {
  return (
    <main className="bg-gradient-main min-h-screen">
      <Navbar />

      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        {/* Top Section: Dashboard Stats */}
        <div className="mb-8 overflow-hidden rounded-2xl">
          <Dashboard />
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Main Column: All Actions unified */}
          <div className="lg:col-span-5 xl:col-span-4 translate-y-0 opacity-0 animate-fade-in-up">
            <ActionPanel />
          </div>

          {/* Activity Column: History & Events */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-8 opacity-0 animate-fade-in-up [animation-delay:100ms] [animation-fill-mode:forwards]">
            
            {/* Live Feed Card */}
            <div className="card h-full max-h-[450px] overflow-hidden flex flex-col">
              <div className="mb-4 flex items-center justify-between border-b border-slate-700/50 pb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="text-indigo-400">⚡</span> Live Protocol Feed
                </h2>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                  <span className="text-xs font-medium text-slate-400">Live Updates</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <EventFeed />
              </div>
            </div>

            {/* Transaction History Card */}
            <div className="card h-full min-h-[400px] flex flex-col">
              <div className="mb-4 flex items-center justify-between border-b border-slate-700/50 pb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="text-indigo-400">📋</span> Your Recent Transactions
                </h2>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <TransactionHistory />
              </div>
            </div>

          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
