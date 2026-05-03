import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { ArchitecturePreview } from '@/components/landing/architecture-preview';
import { FadeIn } from '@/components/landing/fade-in';
import { FinalCta } from '@/components/landing/final-cta';
import { HeroLivePreview } from '@/components/landing/hero-live-preview';
import { HowItWorks } from '@/components/landing/how-it-works';
import { SponsorStrip } from '@/components/landing/sponsor-strip';
import { Wedge } from '@/components/landing/wedge';
import { ARCHITECTURE, HERO } from '@/content/landing';

export default function LandingPage(): React.JSX.Element {
  return (
    <div className="flex flex-col">
      {/* HERO */}
      <section className="relative px-5 pt-20 pb-24 sm:pt-28 sm:pb-32">
        <div className="mx-auto flex max-w-3xl flex-col gap-7">
          <span className="inline-flex w-fit items-center rounded-full border border-border bg-surface px-2.5 py-0.5 text-[0.72rem] font-medium text-muted-foreground">
            {HERO.pill}
          </span>
          <h1 className="text-balance text-4xl font-medium leading-[1.05] tracking-[-0.025em] text-foreground sm:text-[3.4rem]">
            {HERO.headline}
          </h1>
          <p className="max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
            {HERO.subhead}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={HERO.primaryCta.href}
              className="group inline-flex h-11 items-center gap-1.5 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              {HERO.primaryCta.label}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href={HERO.secondaryCta.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center gap-1.5 rounded-md border border-border bg-transparent px-4 text-sm font-medium text-foreground transition-colors hover:border-border-strong"
            >
              {HERO.secondaryCta.label}
            </a>
          </div>
          <p className="font-mono text-[0.78rem] text-muted-foreground">{HERO.metadata}</p>
        </div>

        <div className="mx-auto mt-20 max-w-5xl">
          <FadeIn delay={0.1}>
            <HeroLivePreview />
          </FadeIn>
        </div>
      </section>

      {/* WEDGE */}
      <FadeIn as="section" className="border-t border-border bg-surface/30">
        <div className="mx-auto max-w-5xl px-5 py-20 sm:py-24">
          <Wedge />
        </div>
      </FadeIn>

      {/* HOW IT WORKS */}
      <FadeIn as="section" id="how" className="border-t border-border">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:py-24">
          <header className="mb-12 max-w-2xl">
            <span className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground">
              Lifecycle
            </span>
            <h2 className="mt-2 text-balance text-3xl font-medium tracking-[-0.02em] text-foreground sm:text-[2rem]">
              How a dispute settles
            </h2>
          </header>
          <HowItWorks />
        </div>
      </FadeIn>

      {/* ARCHITECTURE */}
      <FadeIn as="section" id="architecture" className="border-t border-border bg-surface/30">
        <div className="mx-auto max-w-5xl px-5 py-20 sm:py-24">
          <header className="mb-10 max-w-2xl">
            <span className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground">
              Engineering
            </span>
            <h2 className="mt-2 text-balance text-3xl font-medium tracking-[-0.02em] text-foreground sm:text-[2rem]">
              {ARCHITECTURE.heading}
            </h2>
            <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground">
              {ARCHITECTURE.subtitle}
            </p>
          </header>
          <ArchitecturePreview />
        </div>
      </FadeIn>

      {/* SPONSORS */}
      <FadeIn as="section" className="border-t border-border">
        <div className="mx-auto max-w-7xl px-5 py-12">
          <SponsorStrip />
        </div>
      </FadeIn>

      {/* FINAL CTA */}
      <FadeIn as="section" className="border-t border-border bg-surface/30">
        <div className="mx-auto max-w-5xl px-5 py-24 sm:py-28">
          <FinalCta />
        </div>
      </FadeIn>
    </div>
  );
}
