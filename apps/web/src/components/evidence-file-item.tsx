import type { Evidence } from '@tribune/types';
import { FileText } from 'lucide-react';

import { PlainPill } from '@/components/status-pill';
import { cn } from '@/lib/cn';
import { formatBytes, formatRelativeTime } from '@/lib/format';

export function EvidenceFileItem({
  file,
  className,
}: {
  file: Evidence;
  className?: string;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-md border border-border bg-surface px-3 py-2.5',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-md border border-border bg-surface-2 text-muted-foreground">
          <FileText className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-col">
          <p className="truncate text-sm font-medium text-foreground">{file.filename}</p>
          <p className="truncate font-mono text-[0.72rem] text-muted-foreground">
            {formatBytes(file.sizeBytes)} · uploaded {formatRelativeTime(file.createdAt.toString())}
          </p>
        </div>
      </div>
      <PlainPill tone="info">0G Storage</PlainPill>
    </div>
  );
}
