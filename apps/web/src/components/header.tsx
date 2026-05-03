'use client';

import { Scale } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ThemeToggle } from '@/components/theme-toggle';
import { WalletPill } from '@/components/wallet-pill';
import { cn } from '@/lib/cn';

const DEMO_MODE_LABEL = process.env.NEXT_PUBLIC_DEMO_MODE ?? 'Mock panel';

const NAV: Array<{ href: Route; label: string }> = [
  { href: '/disputes', label: 'Disputes' },
  { href: '/agents/buyer.verdikt.eth', label: 'Reputation' },
  { href: '/disputes', label: 'Docs' },
];

export function Header(): React.JSX.Element {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5">
        <div className="flex items-center gap-7">
          <Link
            href="/disputes"
            className="group inline-flex items-center gap-2.5 text-foreground"
            aria-label="Tribune"
          >
            <span className="grid h-7 w-7 place-items-center rounded-md border border-border-strong bg-surface text-foreground transition-colors group-hover:border-foreground">
              <Scale className="h-3.5 w-3.5" strokeWidth={2.4} />
            </span>
            <span className="text-[1.02rem] font-semibold tracking-[-0.01em]">Tribune</span>
            <span
              aria-label={`Demo mode: ${DEMO_MODE_LABEL}`}
              className="ml-1 hidden rounded-full border border-warning/30 bg-warning-soft px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-[0.08em] text-warning sm:inline-flex"
            >
              Demo · {DEMO_MODE_LABEL}
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n, idx) => {
              const active =
                idx === 0
                  ? pathname.startsWith('/disputes')
                  : idx === 1
                    ? pathname.startsWith('/agents')
                    : false;
              return (
                <Link
                  key={`${n.href}-${idx}`}
                  href={n.href}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                    active
                      ? 'bg-surface text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />
          <WalletPill />
        </div>
      </div>
    </header>
  );
}
