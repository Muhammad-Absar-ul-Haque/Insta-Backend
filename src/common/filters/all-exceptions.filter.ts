import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Sentry } from '../sentry/sentry';

/**
 * Catches every exception (expected HttpExceptions like NotFoundException, and
 * unexpected bugs alike), logs *why* the request failed, then sends the same
 * response Nest's built-in handling would have sent anyway — this only adds
 * logging, it doesn't change what the client sees.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsHandler');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const responseBody = isHttpException
      ? exception.getResponse()
      : { statusCode: status, message: 'Internal server error' };

    const errorMessage =
      exception instanceof Error ? exception.message : String(exception);
    const logLine = `${request.method} ${request.originalUrl} -> ${status}: ${errorMessage}`;

    if (status >= 500) {
      // Unexpected — a real bug, not a client mistake. Log the stack so it's actually debuggable.
      this.logger.error(
        logLine,
        exception instanceof Error ? exception.stack : undefined,
      );
      Sentry.captureException(exception);
    } else {
      // Expected client-facing errors (validation, 401/403/404/409...) — message is enough, no stack noise.
      this.logger.warn(logLine);
    }

    response.status(status).json(responseBody);
  }
}
