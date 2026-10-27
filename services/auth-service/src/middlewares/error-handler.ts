import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError, ERROR_CODES, type ErrorDetail } from '../common/errors';
import { logger } from '../config/logger';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

function isJsonParseError(error: unknown): error is SyntaxError & { status: number } {
  return (
    error instanceof SyntaxError &&
    'status' in error &&
    (error as { status?: unknown }).status === 400 &&
    'body' in error
  );
}

/**
 * Central error handler. Operational errors (AppError/Zod) keep their status
 * and message; anything else is logged and returned as a generic 500 so
 * internal details never leak in production.
 */
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const requestId = req.requestId;

  if (error instanceof ZodError) {
    const details: ErrorDetail[] = error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    res.status(400).json({
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Request validation failed',
        details,
        requestId,
      },
    });
    return;
  }

  if (error instanceof AppError) {    if (error.statusCode >= 500) {
      logger.error({ err: error, requestId }, 'Operational server error');
    } else {
      logger.warn(
        { code: error.code, statusCode: error.statusCode, requestId, path: req.originalUrl },
        error.message,
      );
    }

    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
        requestId,
      },
    });
    return;
  }

  if (isJsonParseError(error)) {
    res.status(400).json({
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Malformed JSON body',
        requestId,
      },
    });
    return;
  }

  logger.error({ err: error, requestId }, 'Unhandled error');

  res.status(500).json({
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'Internal server error',
      requestId,
    },
  });
};
