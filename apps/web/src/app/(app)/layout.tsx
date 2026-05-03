import type { ReactNode } from 'react';

import { Header } from '@/components/header';

export default function AppLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Tribune <span className="text-muted-foreground/60">·</span> ERC-792 AI arbitrator
          </span>
          <span className="font-mono">v0.1 · phase 1 mock · 0G testnet (16601)</span>
        </div>
      </footer>
    </div>
  );
}
