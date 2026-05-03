import { Fragment } from 'react';

import { SPONSORS } from '@/content/landing';

export function SponsorStrip(): React.JSX.Element {
  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-8">
      <h3 className="text-[0.95rem] font-medium text-muted-foreground">Built on</h3>
      <p className="font-mono text-sm text-muted-foreground">
        {SPONSORS.map((sponsor, idx) => (
          <Fragment key={sponsor.label}>
            {idx > 0 && <span className="text-muted-foreground/40"> · </span>}
            <a
              href={sponsor.href}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {sponsor.label}
            </a>
          </Fragment>
        ))}
      </p>
    </div>
  );
}
