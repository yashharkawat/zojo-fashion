import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authMiddleware } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { UnauthorizedError } from '../../lib/errors';
import {
  createOrderBodySchema,
  listMyOrdersQuerySchema,
  orderIdParamSchema,
  cancelOrderBodySchema,
} from './orders.schema';
import * as controller from './orders.controller';
import * as ordersService from './orders.service';

export const ordersRouter = Router();

ordersRouter.use(authMiddleware);

ordersRouter.post(
  '/',
  validate({ body: createOrderBodySchema }),
  asyncHandler(controller.createHandler),
);

ordersRouter.get(
  '/my',
  validate({ query: listMyOrdersQuerySchema }),
  asyncHandler(controller.listMyHandler),
);

ordersRouter.get(
  '/:id',
  validate({ params: orderIdParamSchema }),
  asyncHandler(controller.getOneHandler),
);

ordersRouter.put(
  '/:id/cancel',
  validate({ params: orderIdParamSchema, body: cancelOrderBodySchema }),
  asyncHandler(controller.cancelHandler),
);

// Receipt — HTML response, rendered directly (no ApiResponse envelope)
ordersRouter.get(
  '/:id/receipt',
  validate({ params: orderIdParamSchema }),
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new UnauthorizedError();
    const html = await ordersService.receipt(req.auth.userId, req.params.id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }),
);
