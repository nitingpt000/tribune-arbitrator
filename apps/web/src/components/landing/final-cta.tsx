import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { FINAL_CTA } from '@/content/landing';

export function FinalCta(): React.JSX.Element {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
      <h2 className="text-balance text-4xl font-medium tracking-[-0.02em] text-foreground sm:text-5xl">
        {FINAL_CTA.heading}
      </h2>
      <p className="text-pretty text-lg leading-relaxed text-muted-foreground">{FINAL_CTA.body}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href={FINAL_CTA.primary.href}
          className="group inline-flex h-10 items-center gap-1.5 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          {FINAL_CTA.primary.label}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <a
          href={FINAL_CTA.secondary.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border bg-transparent px-4 text-sm font-medium text-foreground transition-colors hover:border-border-strong"
        >
          {FINAL_CTA.secondary.label}
        </a>
      </div>
    </div>
  );
}
