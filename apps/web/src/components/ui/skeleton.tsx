import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('animate-pulse-soft rounded-md bg-muted', className)} {...props} />;
}
