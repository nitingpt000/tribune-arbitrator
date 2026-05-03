'use client';

import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/cn';

export function WalletPill({ ens = 'buyer.eth' }: { ens?: string }): React.JSX.Element {
  return (
    <button
      type="button"
      className={cn(
        'group inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm transition-colors',
        'hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      )}
    >
      <span
        aria-hidden
        className="block h-5 w-5 rounded-full bg-[conic-gradient(from_220deg,oklch(0.78_0.18_50),oklch(0.66_0.22_350),oklch(0.5_0.21_265),oklch(0.78_0.18_50))]"
      />
      <span className="font-mono text-[0.82rem] text-foreground">{ens}</span>
      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-y-px" />
    </button>
  );
}
