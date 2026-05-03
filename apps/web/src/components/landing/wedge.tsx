import { WEDGE } from '@/content/landing';
import { cn } from '@/lib/cn';

export function Wedge(): React.JSX.Element {
  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-16">
      <Column label={WEDGE.left.label} bullets={WEDGE.left.bullets} accent={false} />
      <Column label={WEDGE.right.label} bullets={WEDGE.right.bullets} accent />
      <p className="font-serif italic text-base leading-relaxed text-muted-foreground md:col-span-2">
        {WEDGE.caption}
      </p>
    </div>
  );
}

function Column({
  label,
  bullets,
  accent,
}: {
  label: string;
  bullets: readonly string[];
  accent: boolean;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-5 border-t border-border pt-5">
      <h3
        className={cn(
          'font-mono text-[0.78rem] uppercase tracking-[0.14em]',
          accent ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground',
        )}
      >
        {label}
      </h3>
      <ul className="flex flex-col gap-3 text-[1.02rem] leading-relaxed text-foreground">
        {bullets.map((b) => (
          <li key={b} className="flex gap-3">
            <span
              aria-hidden
              className={cn(
                'mt-2 h-px w-4 flex-none',
                accent ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-border-strong',
              )}
            />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
