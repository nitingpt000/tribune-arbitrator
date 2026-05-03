import { CheckCircle2, Gavel, Loader2 } from 'lucide-react';

import { HERO_DISPUTE, HERO_PANELISTS, type PanelistFixture } from '@/content/landing';
import { cn } from '@/lib/cn';
import { shortenHash } from '@/lib/format';

export function HeroLivePreview(): React.JSX.Element {
  const refundCount = HERO_PANELISTS.filter((p) => p.vote === 'refund').length;
  const total = HERO_PANELISTS.length;
  const refundPct = (refundCount / total) * 100;

  return (
    <figure
      role="img"
      aria-label="Tribune live panel adjudication. Two of three panelists voted refund; the third is still reasoning."
      className="rounded-xl border border-border bg-surface p-3 sm:p-4"
    >
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md border border-border bg-surface-2 text-foreground">
              <Gavel className="h-3.5 w-3.5" strokeWidth={2.2} />
            </span>
            <div className="flex flex-col">
              <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">
                Live panel · {HERO_DISPUTE.shortId}
              </span>
              <span className="text-xs text-foreground">
                Three independent jurors deliberating in parallel
              </span>
            </div>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full border border-warning/25 bg-warning-soft px-2 py-0.5 text-[0.7rem] font-medium text-warning sm:inline-flex">
            <Loader2 className="h-3 w-3 animate-spin" />
            Adjudicating
          </span>
        </header>

        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-1.5 rounded-md border border-border bg-surface/60 p-3 text-xs">
            <span className="text-muted-foreground">Claim</span>
            <span className="text-foreground">{HERO_DISPUTE.summary}</span>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] text-muted-foreground">
              <span>
                Claimant <span className="font-mono text-foreground">{HERO_DISPUTE.claimant}</span>
              </span>
              <span className="text-muted-foreground/60">·</span>
              <span>
                Respondent{' '}
                <span className="font-mono text-foreground">{HERO_DISPUTE.respondent}</span>
              </span>
              <span className="text-muted-foreground/60">·</span>
              <span>
                Tx{' '}
                <span className="font-mono text-foreground">
                  {shortenHash(HERO_DISPUTE.txHash)}
                </span>
              </span>
              <span className="text-muted-foreground/60">·</span>
              <span>
                Amount{' '}
                <span className="font-mono text-foreground">
                  {HERO_DISPUTE.amount} {HERO_DISPUTE.asset}
                </span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {HERO_PANELISTS.map((p) => (
              <PanelistFixtureCard key={p.id} panelist={p} />
            ))}
          </div>

          <div className="flex flex-col gap-2 rounded-md border border-border bg-surface/60 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono uppercase tracking-[0.08em] text-muted-foreground">
                Vote tally
              </span>
              <span className="font-mono text-foreground">
                {refundCount}/{total} cast
              </span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="absolute inset-y-0 left-0 rounded-l-full bg-success transition-[width]"
                style={{ width: `${refundPct}%` }}
              />
            </div>
            <div className="flex items-center gap-5 text-[0.72rem]">
              <Legend dotClass="bg-success" label="Refund" count={refundCount} />
              <Legend dotClass="bg-danger" label="Reject" count={0} />
              <Legend
                dotClass="bg-muted-foreground/40"
                label="Pending"
                count={total - refundCount}
              />
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}

function PanelistFixtureCard({ panelist }: { panelist: PanelistFixture }): React.JSX.Element {
  const isVoted = panelist.status === 'voted';
  return (
    <article
      className={cn(
        'flex h-full flex-col gap-3 rounded-md border bg-surface p-4',
        isVoted ? 'border-border' : 'border-warning/40',
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">
            {isVoted ? 'Voted' : 'Reasoning'}
          </span>
          <h3 className="font-mono text-[0.85rem] font-medium tracking-tight text-foreground">
            {panelist.model}
          </h3>
          <span className="text-[0.7rem] text-muted-foreground">{panelist.affiliation}</span>
        </div>
        {isVoted ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-success/25 bg-success-soft px-2 py-0.5 text-[0.65rem] font-medium text-success">
            <CheckCircle2 className="h-3 w-3" />
            Voted
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-warning/25 bg-warning-soft px-2 py-0.5 text-[0.65rem] font-medium text-warning">
            <Loader2 className="h-3 w-3 animate-spin" />
            Reasoning
          </span>
        )}
      </header>

      <p className="text-[0.78rem] leading-relaxed text-foreground/85">
        {isVoted ? (
          panelist.reasoning
        ) : (
          <>
            {panelist.partial ?? panelist.reasoning}
            <span className="ml-px inline-block h-3 w-1.5 translate-y-px animate-pulse-soft bg-foreground/60 align-middle" />
          </>
        )}
      </p>

      {isVoted && panelist.vote && typeof panelist.confidence === 'number' && (
        <div
          className={cn(
            'flex items-center justify-between rounded-md border px-2.5 py-1.5 text-[0.75rem] font-medium',
            panelist.vote === 'refund'
              ? 'border-success/25 bg-success-soft text-success'
              : 'border-danger/25 bg-danger-soft text-danger',
          )}
        >
          <span>Vote · {panelist.vote}</span>
          <span className="font-mono tabular-nums">
            {Math.round(panelist.confidence * 100)}% conf
          </span>
        </div>
      )}
    </article>
  );
}

function Legend({
  dotClass,
  label,
  count,
}: {
  dotClass: string;
  label: string;
  count: number;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('h-1.5 w-1.5 rounded-full', dotClass)} />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums text-foreground">{count}</span>
    </div>
  );
}
