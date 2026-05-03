import type { DisputeStatus, PanelVoteChoice } from '@tribune/types';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  CheckCircle2,
  CircleSlash2,
  Gavel,
  Hourglass,
  ThumbsDown,
  ThumbsUp,
  type LucideIcon,
} from 'lucide-react';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

const pill = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-none whitespace-nowrap',
  {
    variants: {
      tone: {
        success: 'border-success/25 bg-success-soft text-success',
        warning: 'border-warning/25 bg-warning-soft text-warning',
        danger: 'border-danger/25 bg-danger-soft text-danger',
        info: 'border-info/25 bg-info-soft text-info',
        neutral: 'border-border bg-surface text-muted-foreground',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
);

type Tone = NonNullable<VariantProps<typeof pill>['tone']>;

interface VisualStatus {
  label: string;
  tone: Tone;
  icon: LucideIcon;
}

export function deriveStatus(
  status: DisputeStatus,
  outcome: PanelVoteChoice | null | undefined,
  perspective?: 'mine' | 'counterparty',
): VisualStatus {
  if (status === 'PENDING') return { label: 'Filed', tone: 'info', icon: Hourglass };
  if (status === 'ADJUDICATING') return { label: 'Adjudicating', tone: 'warning', icon: Gavel };
  if (status === 'SETTLED') {
    const isWin = perspective === 'mine';
    return isWin
      ? { label: 'Won', tone: 'success', icon: ThumbsUp }
      : { label: 'Settled · refund', tone: 'success', icon: CheckCircle2 };
  }
  if (status === 'REJECTED') {
    const isLoss = perspective === 'mine';
    return isLoss
      ? { label: 'Lost', tone: 'danger', icon: ThumbsDown }
      : { label: 'Settled · rejected', tone: 'danger', icon: CircleSlash2 };
  }
  return { label: outcome ?? 'Unknown', tone: 'neutral', icon: Hourglass };
}

interface StatusPillProps extends ComponentProps<'span'> {
  status: DisputeStatus;
  outcome?: PanelVoteChoice | null;
  perspective?: 'mine' | 'counterparty';
  size?: 'sm' | 'md';
}

export function StatusPill({
  status,
  outcome,
  perspective,
  size = 'sm',
  className,
  ...props
}: StatusPillProps): React.JSX.Element {
  const visual = deriveStatus(status, outcome, perspective);
  const Icon = visual.icon;
  return (
    <span
      className={cn(pill({ tone: visual.tone }), size === 'md' && 'px-3 py-1 text-sm', className)}
      {...props}
    >
      <Icon className={cn('h-3 w-3 stroke-[2.25]', size === 'md' && 'h-3.5 w-3.5')} aria-hidden />
      {visual.label}
    </span>
  );
}

export function PlainPill({
  tone = 'neutral',
  className,
  children,
  ...props
}: ComponentProps<'span'> & { tone?: Tone }): React.JSX.Element {
  return (
    <span className={cn(pill({ tone }), className)} {...props}>
      {children}
    </span>
  );
}
