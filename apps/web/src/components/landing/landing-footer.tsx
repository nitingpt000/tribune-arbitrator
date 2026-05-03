import Link from 'next/link';

import { LandingMark } from '@/components/landing/landing-mark';
import { FOOTER, REPO_URL } from '@/content/landing';

export function LandingFooter(): React.JSX.Element {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-5 py-12 sm:grid-cols-3">
        <div className="flex flex-col gap-3">
          <Link href="/" className="flex items-center gap-2.5 text-foreground" aria-label="Tribune">
            <LandingMark className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-[1.04rem] font-medium tracking-[-0.01em]">Tribune</span>
          </Link>
          <p className="max-w-xs text-sm text-muted-foreground">{FOOTER.tagline}</p>
        </div>

        <nav aria-label="Footer" className="flex flex-col gap-2 sm:items-center">
          {FOOTER.links.map((link) =>
            link.external ? (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ) : (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ),
          )}
        </nav>

        <div className="flex flex-col gap-2 sm:items-end">
          <span className="text-sm text-muted-foreground">{FOOTER.hackathon}</span>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            github.com/tribune
          </a>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-7xl px-5 py-5 text-center text-[0.8rem] text-muted-foreground/80">
          {FOOTER.legal}
        </p>
      </div>
    </footer>
  );
}
