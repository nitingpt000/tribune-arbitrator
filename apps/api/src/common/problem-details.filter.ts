import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: unknown;
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const responseBody = isHttp ? exception.getResponse() : null;

    let detail: string | undefined;
    let errors: unknown;

    if (typeof responseBody === 'string') {
      detail = responseBody;
    } else if (responseBody && typeof responseBody === 'object') {
      const body = responseBody as Record<string, unknown>;
      detail = typeof body.message === 'string' ? body.message : undefined;
      if (Array.isArray(body.message)) {
        errors = body.message;
        detail = 'Validation failed';
      }
    }

    const problem: ProblemDetails = {
      type: 'about:blank',
      title: HttpStatus[status] ?? 'Error',
      status,
      ...(detail ? { detail } : {}),
      instance: request.originalUrl,
      ...(errors ? { errors } : {}),
    };

    if (status >= 500) {
      this.logger.error(exception);
    }

    response.status(status).type('application/problem+json').json(problem);
  }
}
