import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface StatTileProps {
  label: string;
  value: ReactNode;
  hint?: string;
  trailing?: ReactNode;
  className?: string;
}

export function StatTile({
  label,
  value,
  hint,
  trailing,
  className,
}: StatTileProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-card border border-border bg-surface p-5',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
        {trailing}
      </div>
      <div className="font-mono text-3xl tabular-nums leading-none tracking-[-0.02em] text-foreground">
        {value}
      </div>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
