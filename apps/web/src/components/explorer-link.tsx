'use client';

import { type ComponentPropsWithoutRef, type ReactNode } from 'react';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';

interface ExplorerLinkProps extends Omit<ComponentPropsWithoutRef<'button'>, 'children'> {
  label: ReactNode;
  hint?: string;
}

export function ExplorerLink({
  label,
  hint = 'Will link to explorer in Phase 4',
  className,
  ...props
}: ExplorerLinkProps): React.JSX.Element {
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-1 font-mono text-[0.78rem] tracking-tight text-muted-foreground transition-colors',
              'underline-offset-4 hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:outline-none focus-visible:underline',
              className,
            )}
            {...props}
          >
            {label}
          </button>
        </TooltipTrigger>
        <TooltipContent>{hint}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
