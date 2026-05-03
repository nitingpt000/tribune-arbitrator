export interface DomainLogger {
  child(bindings: Record<string, unknown>): DomainLogger;
  debug(msg: string, context?: Record<string, unknown>): void;
  info(msg: string, context?: Record<string, unknown>): void;
  warn(msg: string, context?: Record<string, unknown>): void;
  error(msg: string, context?: Record<string, unknown>): void;
}

export const LOGGER_PORT = Symbol('DomainLogger');
