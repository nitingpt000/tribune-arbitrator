export interface Clock {
  now(): Date;
  monotonicMs(): number;
  delay(ms: number): Promise<void>;
}

export const CLOCK_PORT = Symbol('Clock');
