'use client';

import type { AgentReputationDisputeRow } from '@tribune/types';
import { ArrowLeft, ArrowUpRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';

import { EnsTextRecordsCard } from '@/components/ens-text-records-card';
import { StatTile } from '@/components/stat-tile';
import { PlainPill } from '@/components/status-pill';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgentReputation } from '@/lib/api/queries';
import { cn } from '@/lib/cn';
import { formatRelativeTime } from '@/lib/format';

interface AgentPageProps {
  params: Promise<{ ens: string }>;
}

const TEXT_RECORD_PLACEHOLDERS: Array<{ key: string; value: string }> = [
  { key: 'avatar', value: 'ipfs://placeholder/avatar.png' },
  { key: 'description', value: 'Tribune agent (Phase 2 mock identity)' },
  { key: 'org.tribune.policy', value: 'cid://policy/v1' },
];

export default function AgentPage({ params }: AgentPageProps): React.JSX.Element {
  const { ens } = use(params);
  const decodedEns = decodeURIComponent(ens);
  const { data: agent, isPending, error } = useAgentReputation(decodedEns);

  if (isPending) return <AgentSkeleton />;
  if (error || !agent) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-16 text-sm text-muted-foreground">
        Agent <span className="font-mono">{decodedEns}</span> not found.{' '}
        <Link href="/disputes" className="underline-offset-4 hover:underline">
          Back to ledger
        </Link>
      </div>
    );
  }

  const upheldRate = agent.totalDisputes > 0 ? agent.disputesWon / agent.totalDisputes : 0;

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-dot-grid opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]"
      />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-5 pb-16 pt-8">
        <Link
          href="/disputes"
          className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Ledger
        </Link>

        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-5">
            <span
              aria-hidden
              className="block h-16 w-16 flex-none rounded-card bg-[conic-gradient(from_220deg,oklch(0.78_0.18_50),oklch(0.66_0.22_350),oklch(0.5_0.21_265),oklch(0.78_0.18_50))]"
            />
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground">
                Agent reputation
              </span>
              <h1 className="font-mono text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
                {agent.ens}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Updated {formatRelativeTime(new Date(agent.updatedAt).toISOString())}
                </span>
                <PlainPill tone="info" className="ml-1">
                  <Sparkles className="h-3 w-3" />
                  ENS-keyed
                </PlainPill>
              </div>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Disputes" value={agent.totalDisputes} hint="Total arbitrated" />
          <StatTile
            label="Won"
            value={agent.disputesWon}
            hint="Ruled in favour"
            trailing={<span className="h-2 w-2 rounded-full bg-success" />}
          />
          <StatTile
            label="Lost"
            value={agent.disputesLost}
            hint="Ruled against"
            trailing={<span className="h-2 w-2 rounded-full bg-danger" />}
          />
          <StatTile
            label="Upheld rate"
            value={`${Math.round(upheldRate * 100)}%`}
            hint={`evidence quality ${agent.evidenceQualityScore.toFixed(1)} / 10`}
          />
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <header className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-foreground">Recent disputes</h2>
              <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">
                {agent.recentDisputes.length} entries
              </span>
            </header>
            {agent.recentDisputes.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-border bg-surface px-6 py-12 text-center">
                <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  No history
                </span>
                <p className="max-w-sm text-pretty text-sm text-muted-foreground">
                  No dispute history yet. Once this agent is involved in a dispute, it will appear
                  here.
                </p>
              </div>
            ) : (
              <ul className="overflow-hidden rounded-card border border-border bg-surface">
                {agent.recentDisputes.map((d, idx) => (
                  <li key={`${d.id}-${idx}`}>
                    <RecentDisputeRow dispute={d} />
                    {idx < agent.recentDisputes.length - 1 && (
                      <span aria-hidden className="block h-px bg-border" />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <header className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-foreground">Identity</h2>
            </header>
            <EnsTextRecordsCard ens={agent.ens} records={TEXT_RECORD_PLACEHOLDERS} />
          </div>
        </section>
      </div>
    </div>
  );
}

function RecentDisputeRow({ dispute }: { dispute: AgentReputationDisputeRow }): React.JSX.Element {
  const isOpen = dispute.outcome === null;
  const isRefund = dispute.outcome === 'REFUND';
  const tone = isOpen ? 'open' : isRefund ? 'refund' : 'reject';
  const label = isOpen ? 'In panel' : isRefund ? 'Refund' : 'Reject';
  return (
    <Link
      href={`/disputes/${dispute.id}`}
      className="group flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-surface-2"
    >
      <div className="flex min-w-0 items-center gap-4">
        <span
          className={cn(
            'h-2 w-2 flex-none rounded-full',
            tone === 'refund' && 'bg-success',
            tone === 'reject' && 'bg-danger',
            tone === 'open' && 'bg-warning',
          )}
          aria-hidden
        />
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {dispute.id.slice(0, 8)}
            </span>
            <span className="text-muted-foreground/60">·</span>
            <span className="text-xs text-foreground">vs</span>
            <span className="font-mono text-xs text-foreground">{dispute.counterparty}</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {label} ·{' '}
            {dispute.closedAt
              ? `closed ${formatRelativeTime(new Date(dispute.closedAt).toISOString())}`
              : 'open'}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm tabular-nums text-foreground">
          {dispute.amountUsdc.toLocaleString()} USDC
        </span>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>
    </Link>
  );
}

function AgentSkeleton(): React.JSX.Element {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 pt-8">
      <div className="flex gap-5">
        <Skeleton className="h-16 w-16 rounded-card" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-7 w-60" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
