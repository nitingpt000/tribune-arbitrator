'use client';

import { PANELIST_MODELS } from '@tribune/types';
import { ArrowLeft, Gavel } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useMemo, useState } from 'react';

import { EvidenceFileItem } from '@/components/evidence-file-item';
import { ExplorerLink } from '@/components/explorer-link';
import { PanelistCard } from '@/components/panelist-card';
import { PlainPill, StatusPill } from '@/components/status-pill';
import { Skeleton } from '@/components/ui/skeleton';
import { VoteTally } from '@/components/vote-tally';
import { useDisputeStream } from '@/lib/api/dispute-stream';
import { useDispute } from '@/lib/api/queries';
import {
  claimTypeLabel,
  isTerminal,
  panelVotesByModel,
  shortDisputeId,
} from '@/lib/dispute-helpers';
import { shortenHash } from '@/lib/format';

interface LivePageProps {
  params: Promise<{ id: string }>;
}

const TARGET_DURATION_MS = 60_000;

export default function LivePage({ params }: LivePageProps): React.JSX.Element {
  const { id } = use(params);
  const router = useRouter();
  const { data: dispute, isPending } = useDispute(id);
  useDisputeStream(id);

  useEffect(() => {
    if (dispute && isTerminal(dispute)) {
      const t = setTimeout(() => router.replace(`/disputes/${id}/verdict`), 700);
      return () => clearTimeout(t);
    }
  }, [dispute, id, router]);

  const elapsed = useElapsed(dispute ? new Date(dispute.createdAt).getTime() : null);

  const orderedVotes = useMemo(() => {
    if (!dispute) return null;
    const byModel = panelVotesByModel(dispute);
    return PANELIST_MODELS.map((model) => byModel.get(model) ?? null);
  }, [dispute]);

  if (isPending && !dispute) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-8">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-[420px] w-full" />
      </div>
    );
  }

  if (!dispute) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-16 text-sm text-muted-foreground">
        Dispute not found.{' '}
        <Link href="/disputes" className="underline-offset-4 hover:underline">
          Back to ledger
        </Link>
      </div>
    );
  }

  const tallyVotes = (orderedVotes ?? []).map((v) => (v && v.status === 'VOTED' ? v.vote : null));

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-dot-grid opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]"
      />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-5 pb-16 pt-8">
        <div className="flex flex-col gap-2">
          <Link
            href="/disputes"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Ledger
          </Link>
          <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[0.72rem] text-muted-foreground">
                  {shortDisputeId(dispute.id)}
                </span>
                <span className="text-muted-foreground/60">·</span>
                <span className="text-xs text-muted-foreground">
                  {claimTypeLabel(dispute.claimType)}
                </span>
                <StatusPill
                  status={dispute.status}
                  outcome={dispute.verdict?.outcome ?? null}
                  className="ml-1"
                />
              </div>
              <h1 className="text-balance text-2xl font-semibold tracking-[-0.01em] text-foreground sm:text-3xl">
                {dispute.statement}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span className="text-muted-foreground">Claimant</span>
                <span className="font-mono text-foreground">{dispute.claimantEns}</span>
                <span className="text-muted-foreground/60">·</span>
                <span className="text-muted-foreground">Respondent</span>
                <span className="font-mono text-foreground">{dispute.respondentEns}</span>
                <span className="text-muted-foreground/60">·</span>
                <span className="text-muted-foreground">Tx</span>
                <ExplorerLink label={shortenHash(dispute.txHash)} />
              </div>
            </div>
            <div className="flex items-center gap-3 self-start lg:self-end">
              <PanelTimer
                elapsedMs={elapsed}
                totalMs={TARGET_DURATION_MS}
                status={dispute.status}
              />
            </div>
          </header>
        </div>

        <section className="flex flex-col gap-5 rounded-card border border-border bg-surface p-5 sm:p-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-md border border-border-strong bg-surface-2 text-foreground">
                <Gavel className="h-4 w-4" />
              </span>
              <div className="flex flex-col">
                <span className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground">
                  Live panel
                </span>
                <span className="text-sm text-foreground">
                  Three independent jurors deliberating in parallel
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <PlainPill tone="info">3-of-3 quorum required</PlainPill>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {(orderedVotes ?? []).map((vote, i) =>
              vote ? (
                <PanelistCard key={vote.id} panelVote={vote} index={i} />
              ) : (
                <Skeleton key={i} className="h-[260px] rounded-card" />
              ),
            )}
          </div>

          <div className="rounded-md border border-border bg-surface-2/60 p-5">
            <VoteTally total={dispute.panelVotes.length || 3} votes={tallyVotes} />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-card border border-border bg-surface p-5 lg:col-span-2">
            <h3 className="mb-3 text-sm font-medium text-foreground">Evidence on file</h3>
            {dispute.evidence.length === 0 ? (
              <p className="text-sm text-muted-foreground">No evidence attached.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {dispute.evidence.map((file) => (
                  <li key={file.id}>
                    <EvidenceFileItem file={file} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-card border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-medium text-foreground">Dispute facts</h3>
            <dl className="flex flex-col gap-3 text-sm">
              <FactRow label="Amount" value={`${dispute.amountUsdc.toLocaleString()} USDC`} mono />
              <FactRow label="Claim type" value={claimTypeLabel(dispute.claimType)} />
              <FactRow label="Filed" value={new Date(dispute.createdAt).toLocaleString()} mono />
              <FactRow label="Quorum" value="3 / 3" mono />
              <FactRow label="Service" value="0G Compute · panel-v3" mono />
            </dl>
          </div>
        </section>
      </div>
    </div>
  );
}

function FactRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-xs uppercase tracking-[0.06em] text-muted-foreground">{label}</dt>
      <dd className={mono ? 'font-mono text-[0.82rem] text-foreground' : 'text-sm text-foreground'}>
        {value}
      </dd>
    </div>
  );
}

function useElapsed(startedAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  if (!startedAt) return 0;
  return Math.max(0, now - startedAt);
}

function PanelTimer({
  elapsedMs,
  totalMs,
  status,
}: {
  elapsedMs: number;
  totalMs: number;
  status: string;
}): React.JSX.Element {
  const seconds = Math.min(99, Math.floor(elapsedMs / 1000));
  const pct = Math.min(100, Math.round((elapsedMs / totalMs) * 100));
  const settled = status === 'SETTLED' || status === 'REJECTED';
  return (
    <div className="flex w-56 flex-col gap-1.5 rounded-card border border-border bg-surface p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">
          {settled ? 'Settled in' : 'Elapsed'}
        </span>
        <span className="font-mono text-base tabular-nums text-foreground">
          {String(seconds).padStart(2, '0')}s
        </span>
      </div>
      <div className="relative h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="absolute inset-y-0 left-0 bg-foreground transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-[0.65rem] tracking-tight text-muted-foreground">
        target ≤ 60s · {status.toLowerCase()}
      </span>
    </div>
  );
}
