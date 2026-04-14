import type { RequestHandler } from 'express';
import { ZodError, type ZodSchema } from 'zod';
import { ValidationError } from '../lib/errors';

interface Schemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, _res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) {
        const parsedQuery = schemas.query.parse(req.query);
        // Express query is readonly-ish; reassign via Object.assign
        Object.assign(req.query, parsedQuery);
      }
      if (schemas.params) {
        const parsedParams = schemas.params.parse(req.params);
        Object.assign(req.params, parsedParams);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(
          new ValidationError(
            'Request validation failed',
            err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
          ),
        );
      }
      next(err);
    }
  };
