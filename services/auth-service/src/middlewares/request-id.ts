import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

const MAX_INCOMING_ID_LENGTH = 100;

/**
 * Every response carries an X-Request-Id so a client error can be correlated
 * with the structured server logs.
 */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  const id =
    incoming && incoming.length > 0 && incoming.length <= MAX_INCOMING_ID_LENGTH
      ? incoming
      : randomUUID();

  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
};
