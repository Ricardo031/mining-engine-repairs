import type { RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';
import { AppError, type ErrorDetail } from '../common/errors';

export interface RequestValidation {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

type ValidationKey = 'body' | 'query' | 'params';

/**
 * Parses body/query/params with Zod and stores the sanitized values in
 * `res.locals.validated`. Controllers read them through `validated<T>()`.
 *
 * Unknown keys are stripped by the schemas, so handlers never receive
 * unexpected input.
 */
export function validate(schemas: RequestValidation): RequestHandler {
  return (req, res, next) => {
    const validatedData: Partial<Record<ValidationKey, unknown>> = {};
    const details: ErrorDetail[] = [];

    for (const key of ['body', 'params', 'query'] as const) {
      const schema = schemas[key];
      if (!schema) continue;

      const input = key === 'body' ? (req.body ?? {}) : req[key];
      const result = schema.safeParse(input);

      if (!result.success) {
        for (const issue of result.error.issues) {
          details.push({
            path: [key, ...issue.path].join('.'),
            message: issue.message,
          });
        }
        continue;
      }

      validatedData[key] = result.data;
    }

    if (details.length > 0) {
      next(AppError.badRequest('Request validation failed', details));
      return;
    }

    res.locals.validated = validatedData;

    // Express 5 exposes `req.query` as a getter, so only `body` is replaced.
    if (validatedData.body !== undefined) {
      req.body = validatedData.body;
    }

    next();
  };
}

export function validated<T>(res: Response, key: ValidationKey): T {
  const data = res.locals.validated as Partial<Record<ValidationKey, unknown>> | undefined;
  return data?.[key] as T;
}
