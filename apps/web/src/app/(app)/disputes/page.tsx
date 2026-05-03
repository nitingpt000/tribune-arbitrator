'use client';

import { ArrowRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { DisputeCard } from '@/components/dispute-card';
import { StatTile } from '@/components/stat-tile';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDisputes, useStats } from '@/lib/api/queries';
import { cn } from '@/lib/cn';
import { votePerspective } from '@/lib/dispute-helpers';

const ME = 'buyer.verdikt.eth';

type Filter = 'all' | 'active' | 'mine' | 'settled';

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'mine', label: 'Mine' },
  { key: 'settled', label: 'Settled' },
];

const usdc = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export default function DisputesDashboard(): React.JSX.Element {
  const [filter, setFilter] = useState<Filter>('all');
  const { data: list, isPending: listLoading } = useDisputes({ limit: 50 });
  const { data: stats } = useStats();

  const visible = useMemo(() => {
    const all = list?.disputes ?? [];
    if (filter === 'all') return all;
    if (filter === 'active') {
      return all.filter((d) => d.status === 'PENDING' || d.status === 'ADJUDICATING');
    }
    if (filter === 'mine') {
      return all.filter((d) => d.claimantEns === ME || d.respondentEns === ME);
    }
    if (filter === 'settled') return all.filter((d) => d.status === 'SETTLED');
    return all;
  }, [list, filter]);

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-dot-grid opacity-50 [mask-image:linear-gradient(to_bottom,black,transparent)]"
      />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-5 pb-16 pt-10">
        <header className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground">
              Dispute ledger
            </span>
            <h1 className="text-balance text-3xl font-semibold tracking-[-0.02em] text-foreground sm:text-4xl">
              Settle disagreements between agents in under a minute.
            </h1>
            <p className="max-w-2xl text-pretty text-[0.95rem] leading-relaxed text-muted-foreground">
              Tribune is an ERC-792-compatible arbitrator. File a dispute, attach evidence, and a
              panel of three independent LLMs deliberates and rules on chain.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/disputes/new"
              className="inline-flex h-10 items-center gap-2 rounded-input bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-foreground/85"
            >
              <Plus className="h-4 w-4" strokeWidth={2.4} />
              File a dispute
            </Link>
            <Link
              href="/agents/buyer.verdikt.eth"
              className="inline-flex h-10 items-center gap-1.5 rounded-input border border-border bg-surface px-4 text-sm text-foreground transition-colors hover:border-border-strong"
            >
              View an agent
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Total filed" value={stats?.total ?? '—'} hint="Across all parties" />
          <StatTile
            label="Active"
            value={stats?.active ?? '—'}
            hint="Pending or adjudicating"
            trailing={<span className="h-2 w-2 animate-pulse-soft rounded-full bg-warning" />}
          />
          <StatTile label="Settled" value={stats?.settled ?? '—'} hint="Verdict finalised" />
          <StatTile
            label="Refunded · USDC"
            value={stats ? usdc.format(stats.refundedUsdc) : '—'}
            hint={
              stats?.avgSettlementSeconds
                ? `avg ${stats.avgSettlementSeconds.toFixed(1)}s settlement`
                : 'Settled refund volume'
            }
          />
        </section>

        <section className="flex flex-col gap-5">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <div className="flex items-center justify-between">
              <TabsList>
                {FILTERS.map((f) => (
                  <TabsTrigger key={f.key} value={f.key}>
                    {f.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              <span className="hidden text-xs text-muted-foreground sm:inline-flex">
                {visible.length} {visible.length === 1 ? 'dispute' : 'disputes'}
              </span>
            </div>

            {FILTERS.map((f) => (
              <TabsContent key={f.key} value={f.key}>
                {listLoading ? (
                  <DisputeListSkeleton />
                ) : visible.length === 0 ? (
                  <EmptyState />
                ) : (
                  <ul className={cn('grid grid-cols-1 gap-3 lg:grid-cols-2')}>
                    {visible.map((dispute) => (
                      <li key={dispute.id}>
                        <DisputeCard dispute={dispute} perspective={votePerspective(ME, dispute)} />
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </section>
      </div>
    </div>
  );
}

function DisputeListSkeleton(): React.JSX.Element {
  return (
    <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i}>
          <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-9 w-full" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState(): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border bg-surface px-6 py-16 text-center">
      <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
        No disputes
      </span>
      <p className="max-w-sm text-pretty text-sm text-muted-foreground">
        File your first dispute to populate the ledger. The panel deliberates and rules in under a
        minute.
      </p>
      <Link
        href="/disputes/new"
        className="mt-2 inline-flex h-9 items-center gap-2 rounded-input bg-foreground px-3 text-sm font-medium text-background transition-colors hover:bg-foreground/85"
      >
        <Plus className="h-3.5 w-3.5" />
        File your first dispute
      </Link>
    </div>
  );
}
