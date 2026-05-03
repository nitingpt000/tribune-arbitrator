'use client';

import type { PanelVote, PanelVoteChoice } from '@tribune/types';
import { CheckCircle2, CircleSlash2, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

import { PlainPill } from '@/components/status-pill';
import { cn } from '@/lib/cn';

const PANELIST_AFFILIATION: Record<string, string> = {
  'qwen3.6-plus': 'Alibaba',
  'glm-5-fp8': 'Zhipu AI',
  'llama-4-70b': 'Meta',
};

interface PanelistCardProps {
  panelVote: PanelVote;
  index: number;
}

function ReasoningStream({ text, active }: { text: string; active: boolean }): React.JSX.Element {
  const [chars, setChars] = useState(active ? 0 : text.length);

  useEffect(() => {
    if (!active) {
      setChars(text.length);
      return;
    }
    setChars(0);
    const total = text.length;
    const start = performance.now();
    const duration = 4200;
    let frame = 0;
    const tick = (t: number): void => {
      const progress = Math.min(1, (t - start) / duration);
      const next = Math.floor(progress * total);
      setChars(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, active]);

  return (
    <p className="text-pretty text-[0.86rem] leading-relaxed text-foreground/85">
      {text.slice(0, chars)}
      {active && chars < text.length ? (
        <span className="ml-px inline-block h-3 w-1.5 translate-y-px animate-pulse-soft bg-foreground/60 align-middle" />
      ) : null}
    </p>
  );
}

function VoteRow({
  vote,
  confidence,
}: {
  vote: PanelVoteChoice;
  confidence: number;
}): React.JSX.Element {
  const isRefund = vote === 'REFUND';
  const isReject = vote === 'REJECT';
  const tone = isRefund ? 'success' : isReject ? 'danger' : 'neutral';
  return (
    <div
      className={cn(
        'mt-3 flex items-center justify-between gap-3 rounded-md border px-3 py-2',
        tone === 'success' && 'border-success/25 bg-success-soft text-success',
        tone === 'danger' && 'border-danger/25 bg-danger-soft text-danger',
        tone === 'neutral' && 'border-border bg-surface text-muted-foreground',
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        {isRefund ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : (
          <CircleSlash2 className="h-3.5 w-3.5" />
        )}
        Vote · {vote.toLowerCase()}
      </div>
      <div className="flex items-baseline gap-1 font-mono text-[0.78rem] tabular-nums">
        <span>{Math.round(confidence * 100)}%</span>
        <span className="text-current/70">conf</span>
      </div>
    </div>
  );
}

export function PanelistCard({ panelVote, index }: PanelistCardProps): React.JSX.Element {
  const status = panelVote.status;
  const isVoted = status === 'VOTED';
  const isReasoning = status === 'REASONING';
  const isPending = status === 'PENDING';
  const affiliation = PANELIST_AFFILIATION[panelVote.modelName] ?? 'Independent';

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'flex h-full flex-col gap-4 rounded-card border bg-surface p-5 transition-colors',
        isVoted && 'border-border-strong',
        isReasoning && 'border-warning/40',
        isPending && 'border-border opacity-90',
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
            Panelist {String(index + 1).padStart(2, '0')}
          </span>
          <h3 className="font-mono text-[0.95rem] font-medium tracking-tight text-foreground">
            {panelVote.modelName}
          </h3>
          <span className="text-xs text-muted-foreground">{affiliation}</span>
        </div>
        {isPending && (
          <PlainPill tone="neutral">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
            Pending
          </PlainPill>
        )}
        {isReasoning && (
          <PlainPill tone="warning">
            <Loader2 className="h-3 w-3 animate-spin" />
            Reasoning
          </PlainPill>
        )}
        {isVoted && (
          <PlainPill tone="success">
            <CheckCircle2 className="h-3 w-3" />
            Voted
          </PlainPill>
        )}
      </header>

      {isPending ? (
        <div className="flex flex-1 flex-col gap-2">
          <span className="block h-2 w-3/4 rounded-full bg-muted" />
          <span className="block h-2 w-5/6 rounded-full bg-muted" />
          <span className="block h-2 w-2/3 rounded-full bg-muted" />
          <span className="block h-2 w-4/6 rounded-full bg-muted" />
        </div>
      ) : (
        <ReasoningStream text={panelVote.reasoning} active={isReasoning} />
      )}

      {isVoted && <VoteRow vote={panelVote.vote} confidence={panelVote.confidence} />}
    </motion.article>
  );
}
