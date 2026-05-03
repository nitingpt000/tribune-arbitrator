'use client';

import type { PanelVoteChoice } from '@tribune/types';
import { motion } from 'motion/react';

import { cn } from '@/lib/cn';

interface VoteTallyProps {
  total: number;
  votes: Array<PanelVoteChoice | null>;
}

export function VoteTally({ total, votes }: VoteTallyProps): React.JSX.Element {
  const refunds = votes.filter((v) => v === 'REFUND').length;
  const rejects = votes.filter((v) => v === 'REJECT').length;
  const pending = total - refunds - rejects;
  const refundPct = (refunds / total) * 100;
  const rejectPct = (rejects / total) * 100;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="uppercase tracking-[0.08em]">Vote tally</span>
        <span className="font-mono">
          {refunds + rejects}/{total} cast
        </span>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="absolute inset-y-0 left-0 bg-success"
          initial={{ width: 0 }}
          animate={{ width: `${refundPct}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.div
          className="absolute inset-y-0 bg-danger"
          initial={{ width: 0 }}
          animate={{ left: `${refundPct}%`, width: `${rejectPct}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <div className="flex items-center gap-5 text-xs">
        <Legend dotClass="bg-success" label="Refund" count={refunds} />
        <Legend dotClass="bg-danger" label="Reject" count={rejects} />
        <Legend dotClass="bg-muted-foreground/40" label="Pending" count={pending} />
      </div>
    </div>
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
    <div className="flex items-center gap-2">
      <span className={cn('h-2 w-2 rounded-full', dotClass)} />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums text-foreground">{count}</span>
    </div>
  );
}
