import { ARCHITECTURE } from '@/content/landing';

export function ArchitecturePreview(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-10">
      <div
        className="architecture-diagram-placeholder relative w-full overflow-hidden rounded-xl border border-border bg-surface"
        style={{ aspectRatio: '680 / 720' }}
      >
        <div
          aria-hidden
          className="absolute inset-0 [background-image:linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] [background-size:32px_32px] opacity-40"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground">
              placeholder
            </span>
            <p className="text-sm text-muted-foreground">Hexagonal architecture diagram</p>
            <p className="max-w-xs text-[0.78rem] text-muted-foreground/80">
              Domain core in the centre. Adapters for 0G Compute, 0G Storage, KeeperHub, ENS, and
              Uniswap on the edges.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {ARCHITECTURE.pillars.map((pillar) => (
          <div key={pillar.title} className="flex flex-col gap-2">
            <h3 className="text-[1.02rem] font-medium tracking-tight text-foreground">
              {pillar.title}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{pillar.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
