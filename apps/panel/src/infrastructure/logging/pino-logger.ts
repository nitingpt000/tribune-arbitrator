import type { Logger as PinoLogger } from 'pino';

import type { DomainLogger } from '../../domain/ports/logger.port';

export class PinoDomainLogger implements DomainLogger {
  constructor(private readonly logger: PinoLogger) {}

  child(bindings: Record<string, unknown>): DomainLogger {
    return new PinoDomainLogger(this.logger.child(bindings));
  }
  debug(msg: string, context: Record<string, unknown> = {}): void {
    this.logger.debug(context, msg);
  }
  info(msg: string, context: Record<string, unknown> = {}): void {
    this.logger.info(context, msg);
  }
  warn(msg: string, context: Record<string, unknown> = {}): void {
    this.logger.warn(context, msg);
  }
  error(msg: string, context: Record<string, unknown> = {}): void {
    this.logger.error(context, msg);
  }
}

export class ConsoleDomainLogger implements DomainLogger {
  constructor(private readonly bindings: Record<string, unknown> = {}) {}
  child(bindings: Record<string, unknown>): DomainLogger {
    return new ConsoleDomainLogger({ ...this.bindings, ...bindings });
  }
  private out(level: string, msg: string, context: Record<string, unknown>): void {
    const payload = { level, msg, ...this.bindings, ...context };
    if (level === 'error' || level === 'warn') {
      console.error(JSON.stringify(payload));
    } else {
      console.log(JSON.stringify(payload));
    }
  }
  debug(msg: string, context: Record<string, unknown> = {}): void {
    this.out('debug', msg, context);
  }
  info(msg: string, context: Record<string, unknown> = {}): void {
    this.out('info', msg, context);
  }
  warn(msg: string, context: Record<string, unknown> = {}): void {
    this.out('warn', msg, context);
  }
  error(msg: string, context: Record<string, unknown> = {}): void {
    this.out('error', msg, context);
  }
}

export class NoopDomainLogger implements DomainLogger {
  child(): DomainLogger {
    return this;
  }
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}
