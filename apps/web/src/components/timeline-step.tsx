import type { SettlementStep, SettlementStepType } from '@tribune/types';
import { Check, CircleSlash2, Hourglass, Loader2 } from 'lucide-react';

import { ExplorerLink } from '@/components/explorer-link';
import { cn } from '@/lib/cn';
import { formatDateTime, shortenHash } from '@/lib/format';

const STEP_TITLE: Record<SettlementStepType, string> = {
  VERDICT_ONCHAIN: 'Verdict relayed',
  KEEPER_CLAIMED: 'Keeper-guaranteed',
  FUNDS_RELEASED: 'Funds released',
  ENS_REPUTATION: 'Reputation written',
};

const STEP_SERVICE: Record<SettlementStepType, string> = {
  VERDICT_ONCHAIN: 'KeeperHub',
  KEEPER_CLAIMED: 'KeeperHub',
  FUNDS_RELEASED: 'Uniswap',
  ENS_REPUTATION: 'ENS',
};

interface TimelineStepProps {
  step: SettlementStep;
  isLast?: boolean;
}

export function TimelineStep({ step, isLast }: TimelineStepProps): React.JSX.Element {
  const isCompleted = step.status === 'COMPLETED';
  const isInProgress = step.status === 'IN_PROGRESS';
  const isFailed = step.status === 'FAILED';
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {!isLast && (
        <span
          aria-hidden
          className={cn(
            'absolute left-[18px] top-9 h-[calc(100%-1.75rem)] w-px',
            isCompleted ? 'bg-border-strong' : 'bg-border',
          )}
        />
      )}
      <div
        className={cn(
          'relative z-10 mt-0.5 grid h-9 w-9 flex-none place-items-center rounded-full border',
          isCompleted && 'border-success/30 bg-success-soft text-success',
          isInProgress && 'border-warning/30 bg-warning-soft text-warning',
          isFailed && 'border-danger/30 bg-danger-soft text-danger',
          !isCompleted &&
            !isInProgress &&
            !isFailed &&
            'border-border bg-surface text-muted-foreground',
        )}
      >
        {isCompleted && <Check className="h-4 w-4" strokeWidth={2.6} />}
        {isInProgress && <Loader2 className="h-4 w-4 animate-spin" />}
        {isFailed && <CircleSlash2 className="h-4 w-4" />}
        {!isCompleted && !isInProgress && !isFailed && <Hourglass className="h-3.5 w-3.5" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
            {STEP_SERVICE[step.step]}
          </span>
          {step.completedAt && (
            <span className="font-mono text-[0.72rem] text-muted-foreground">
              {formatDateTime(step.completedAt.toString())}
            </span>
          )}
        </div>
        <h4 className="text-sm font-medium text-foreground">{STEP_TITLE[step.step]}</h4>
        {step.detail && <p className="text-sm text-muted-foreground">{step.detail}</p>}
        {step.txHash && <ExplorerLink label={shortenHash(step.txHash, 10, 8)} className="mt-1" />}
      </div>
    </li>
  );
}
