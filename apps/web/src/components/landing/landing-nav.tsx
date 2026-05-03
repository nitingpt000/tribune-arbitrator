'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { LandingMark } from '@/components/landing/landing-mark';
import { ThemeToggle } from '@/components/theme-toggle';
import { HERO, NAV_LINKS, REPO_URL } from '@/content/landing';
import { cn } from '@/lib/cn';

export function LandingNav(): React.JSX.Element {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-200',
        scrolled
          ? 'border-b border-border bg-background/85 backdrop-blur-md backdrop-saturate-150'
          : 'border-b border-transparent bg-background/0',
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5">
        <Link href="/" className="flex items-center gap-2.5 text-foreground" aria-label="Tribune">
          <LandingMark className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <span className="text-[1.04rem] font-medium tracking-[-0.01em]">Tribune</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.label} link={link} />
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />
          <Link
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden h-9 items-center rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:border-border-strong sm:inline-flex"
          >
            View on GitHub
          </Link>
          <Link
            href={HERO.primaryCta.href}
            className="group inline-flex h-9 items-center gap-1.5 rounded-md bg-indigo-600 px-3 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            Try the demo
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function NavLink({
  link,
}: {
  link: { label: string; href: string; external?: boolean };
}): React.JSX.Element {
  const className =
    'text-sm font-normal text-muted-foreground transition-colors hover:text-foreground';
  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noreferrer" className={className}>
        {link.label}
      </a>
    );
  }
  return (
    <a href={link.href} className={className}>
      {link.label}
    </a>
  );
}
