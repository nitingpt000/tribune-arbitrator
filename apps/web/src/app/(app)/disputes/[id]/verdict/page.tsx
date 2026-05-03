'use client';

import { ArrowLeft, CheckCircle2, CircleSlash2 } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';

import { EvidenceFileItem } from '@/components/evidence-file-item';
import { ExplorerLink } from '@/components/explorer-link';
import { PlainPill, StatusPill } from '@/components/status-pill';
import { TimelineStep } from '@/components/timeline-step';
import { Skeleton } from '@/components/ui/skeleton';
import { VoteTally } from '@/components/vote-tally';
import { useDispute } from '@/lib/api/queries';
import { cn } from '@/lib/cn';
import { claimTypeLabel, shortDisputeId } from '@/lib/dispute-helpers';
import { formatDateTime, shortenHash } from '@/lib/format';

interface VerdictPageProps {
  params: Promise<{ id: string }>;
}

export default function VerdictPage({ params }: VerdictPageProps): React.JSX.Element {
  const { id } = use(params);
  const { data: dispute, isPending } = useDispute(id);

  if (isPending && !dispute) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-8">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-72 w-full" />
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

  const isRefund = dispute.verdict?.outcome === 'REFUND';
  const votes = dispute.panelVotes.map((p) => p.vote);
  const refundVotes = votes.filter((v) => v === 'REFUND').length;
  const rejectVotes = votes.filter((v) => v === 'REJECT').length;

  const settledAt = dispute.verdict?.createdAt;
  const settlementTx = dispute.settlementSteps.find(
    (s) => s.step === 'VERDICT_ONCHAIN' && s.txHash,
  )?.txHash;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 pb-16 pt-8">
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
          </div>
        </header>
      </div>

      <section
        className={cn(
          'relative overflow-hidden rounded-card border p-6 sm:p-8',
          isRefund ? 'border-success/30 bg-success-soft/40' : 'border-danger/30 bg-danger-soft/40',
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-noise opacity-30 mix-blend-overlay"
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground">
              Verdict
            </span>
            <div className="flex items-baseline gap-3">
              <h2
                className={cn(
                  'font-mono text-4xl font-semibold tracking-[-0.02em] sm:text-5xl',
                  isRefund ? 'text-success' : 'text-danger',
                )}
              >
                {isRefund ? 'Refund' : 'Reject'}
              </h2>
              <span className="text-sm text-muted-foreground">
                · {refundVotes}–{rejectVotes} on the panel
              </span>
            </div>
            <p className="max-w-xl text-pretty text-sm text-muted-foreground">
              {isRefund
                ? `Panel ruled in favour of ${dispute.claimantEns}. Settlement of ${dispute.amountUsdc.toLocaleString()} USDC authorised; pipeline executing now.`
                : `Panel ruled in favour of ${dispute.respondentEns}. No settlement transferred; reputation updates recorded.`}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <PlainPill tone={isRefund ? 'success' : 'danger'}>
              {isRefund ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <CircleSlash2 className="h-3 w-3" />
              )}
              Verdict signed 3/3
            </PlainPill>
            {settlementTx && (
              <ExplorerLink
                label={`settle · ${shortenHash(settlementTx, 8, 6)}`}
                hint="Settlement transaction (mock)"
              />
            )}
            {settledAt && (
              <span className="font-mono text-xs text-muted-foreground">
                {formatDateTime(new Date(settledAt).toISOString())}
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-card border border-border bg-surface p-5 lg:col-span-2">
          <header className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">Settlement pipeline</h3>
            <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">
              KeeperHub → Uniswap → ENS
            </span>
          </header>
          <ol className="flex flex-col">
            {dispute.settlementSteps.map((step, i) => (
              <TimelineStep
                key={step.id}
                step={step}
                isLast={i === dispute.settlementSteps.length - 1}
              />
            ))}
          </ol>
        </div>
        <div className="flex flex-col gap-4">
          <div className="rounded-card border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-medium text-foreground">Vote tally</h3>
            <VoteTally total={dispute.panelVotes.length} votes={votes} />
          </div>
          <div className="rounded-card border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-medium text-foreground">Dispute facts</h3>
            <dl className="flex flex-col gap-3 text-sm">
              <Fact label="Amount" value={`${dispute.amountUsdc.toLocaleString()} USDC`} mono />
              <Fact label="Claimant" value={dispute.claimantEns} mono />
              <Fact label="Respondent" value={dispute.respondentEns} mono />
              <Fact
                label="Filed"
                value={formatDateTime(new Date(dispute.createdAt).toISOString())}
                mono
              />
              {settledAt && (
                <Fact
                  label="Settled"
                  value={formatDateTime(new Date(settledAt).toISOString())}
                  mono
                />
              )}
              {dispute.verdict && (
                <Fact
                  label="Duration"
                  value={`${(dispute.verdict.totalDurationMs / 1000).toFixed(1)}s`}
                  mono
                />
              )}
            </dl>
          </div>
        </div>
      </section>

      <section className="rounded-card border border-border bg-surface p-5">
        <header className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Panel reasoning</h3>
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">
            {dispute.panelVotes.length} panelists
          </span>
        </header>
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {dispute.panelVotes.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-3 rounded-md border border-border bg-surface-2/60 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col">
                  <span className="font-mono text-[0.85rem] font-medium text-foreground">
                    {p.modelName}
                  </span>
                  <span className="text-[0.7rem] text-muted-foreground">
                    confidence {Math.round(p.confidence * 100)}%
                  </span>
                </div>
                <PlainPill
                  tone={
                    p.vote === 'REFUND' ? 'success' : p.vote === 'REJECT' ? 'danger' : 'neutral'
                  }
                >
                  {p.vote.toLowerCase()}
                </PlainPill>
              </div>
              <p className="text-pretty text-[0.83rem] leading-relaxed text-foreground/80">
                {p.reasoning}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {dispute.evidence.length > 0 && (
        <section className="rounded-card border border-border bg-surface p-5">
          <header className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">Evidence considered</h3>
            <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">
              {dispute.evidence.length} files
            </span>
          </header>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {dispute.evidence.map((file) => (
              <li key={file.id}>
                <EvidenceFileItem file={file} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <p className="text-xs text-muted-foreground">
          Verdict ID <span className="font-mono text-foreground">{shortDisputeId(dispute.id)}</span>{' '}
          · binding per ERC-792
        </p>
        <div className="flex items-center gap-3">
          <Link
            href={`/agents/${dispute.claimantEns}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-input border border-border bg-surface px-3 text-sm text-foreground transition-colors hover:border-border-strong"
          >
            View claimant reputation
          </Link>
          <Link
            href="/disputes/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-input bg-foreground px-3 text-sm font-medium text-background transition-colors hover:bg-foreground/85"
          >
            File another dispute
          </Link>
        </div>
      </div>
    </div>
  );
}

function Fact({
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
      <dd
        className={
          mono ? 'truncate font-mono text-[0.82rem] text-foreground' : 'text-sm text-foreground'
        }
      >
        {value}
      </dd>
    </div>
  );
}
