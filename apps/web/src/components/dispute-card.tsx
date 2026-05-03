import type { DisputeSummary } from '@tribune/types';
import { ArrowUpRight } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';

import { ExplorerLink } from '@/components/explorer-link';
import { StatusPill } from '@/components/status-pill';
import { cn } from '@/lib/cn';
import { claimTypeLabel, shortDisputeId } from '@/lib/dispute-helpers';
import { formatRelativeTime, shortenHash } from '@/lib/format';

interface DisputeCardProps {
  dispute: DisputeSummary;
  perspective?: 'mine' | 'counterparty';
  className?: string;
}

const usdcFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
});

export function DisputeCard({
  dispute,
  perspective,
  className,
}: DisputeCardProps): React.JSX.Element {
  const href = `/disputes/${dispute.id}` as Route;
  return (
    <article
      className={cn(
        'group relative flex flex-col gap-4 rounded-card border border-border bg-surface p-5 transition-all',
        'hover:border-border-strong hover:bg-surface-2 focus-within:border-border-strong',
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {shortDisputeId(dispute.id)}
            </span>
            <span className="text-muted-foreground/60">·</span>
            <span className="text-xs text-muted-foreground">
              {claimTypeLabel(dispute.claimType)}
            </span>
          </div>
          <Link
            href={href}
            className="text-[0.95rem] font-medium leading-snug tracking-tight text-foreground transition-colors hover:text-foreground/80 focus-visible:outline-none focus-visible:underline"
          >
            <span className="absolute inset-0" aria-hidden />
            {dispute.statement}
          </Link>
        </div>
        <StatusPill
          status={dispute.status}
          outcome={dispute.verdict?.outcome ?? null}
          perspective={perspective}
        />
      </header>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Claimant</span>
          <span className="font-mono text-[0.82rem] text-foreground">{dispute.claimantEns}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Respondent</span>
          <span className="font-mono text-[0.82rem] text-foreground">{dispute.respondentEns}</span>
        </div>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Amount in dispute</span>
          <span className="font-mono text-sm text-foreground">
            {usdcFormatter.format(dispute.amountUsdc)} USDC
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ExplorerLink
            label={shortenHash(dispute.txHash)}
            className="relative z-10"
            onClick={(e) => e.stopPropagation()}
          />
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(dispute.createdAt.toString())}
          </span>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
        </div>
      </footer>
    </article>
  );
}
