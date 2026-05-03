'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'section';
  id?: string;
}

export function FadeIn({
  children,
  delay = 0,
  className,
  as = 'div',
  id,
}: FadeInProps): React.JSX.Element {
  const reduce = useReducedMotion();
  const Component = as === 'section' ? motion.section : motion.div;

  return (
    <Component
      id={id}
      className={className}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Component>
  );
}
