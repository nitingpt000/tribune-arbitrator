import type { Clock } from '../../domain/ports/clock.port';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
  monotonicMs(): number {
    return performance.now();
  }
  delay(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((res) => setTimeout(res, ms));
  }
}

export class FastClock implements Clock {
  private current = 0;
  now(): Date {
    return new Date(this.current);
  }
  monotonicMs(): number {
    return this.current;
  }
  delay(ms: number): Promise<void> {
    this.current += ms;
    return Promise.resolve();
  }
  advance(ms: number): void {
    this.current += ms;
  }
}
