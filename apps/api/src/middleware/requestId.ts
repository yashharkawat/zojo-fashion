import type { RequestHandler } from 'express';
import { v4 as uuid } from 'uuid';

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  const id = incoming && /^[a-zA-Z0-9-]{8,64}$/.test(incoming) ? incoming : uuid();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
};
