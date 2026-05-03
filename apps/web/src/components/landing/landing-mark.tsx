import type { SVGProps } from 'react';

export function LandingMark({ className, ...props }: SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor" {...props}>
      <rect x="4" y="6" width="16" height="2" rx="1" />
      <rect x="4" y="11" width="16" height="2" rx="1" />
      <rect x="4" y="16" width="16" height="2" rx="1" />
    </svg>
  );
}
