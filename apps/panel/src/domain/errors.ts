export class DomainError extends Error {
  readonly code: string;
  readonly context: Record<string, unknown>;
  constructor(code: string, message: string, context: Record<string, unknown> = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
  }
}

export class NoAvailableModels extends DomainError {
  constructor(found: number) {
    super('no_available_models', `Need 3 distinct inference models, only ${found} available`, {
      found,
    });
  }
}

export class EvidenceTooLarge extends DomainError {
  constructor(sizeBytes: number, maxBytes: number) {
    super(
      'evidence_too_large',
      `Evidence bundle is ${sizeBytes} bytes, exceeds ${maxBytes} byte cap`,
      { sizeBytes, maxBytes },
    );
  }
}

export class AdjudicationTimeout extends DomainError {
  constructor(modelName: string, deadlineMs: number) {
    super('adjudication_timeout', `Panelist ${modelName} did not return within ${deadlineMs}ms`, {
      modelName,
      deadlineMs,
    });
  }
}

export class InferenceError extends DomainError {
  constructor(
    code:
      | 'attestation_failed'
      | 'http_error'
      | 'malformed_response'
      | 'parse_failed'
      | 'broker_unavailable'
      | 'unknown',
    message: string,
    context: Record<string, unknown> = {},
  ) {
    super(`inference_${code}`, message, context);
  }
}

export class StorageError extends DomainError {
  constructor(
    code: 'upload_failed' | 'download_failed' | 'encryption_failed' | 'unknown',
    message: string,
    context: Record<string, unknown> = {},
  ) {
    super(`storage_${code}`, message, context);
  }
}

export class ExecutionError extends DomainError {
  constructor(
    code: 'submit_failed' | 'callback_failed' | 'unknown',
    message: string,
    context: Record<string, unknown> = {},
  ) {
    super(`execution_${code}`, message, context);
  }
}
