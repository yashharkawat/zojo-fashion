import { Router } from 'express';
import { prisma } from '../../config/prisma';
import { asyncHandler } from '../../lib/asyncHandler';
import { NotFoundError } from '../../lib/errors';

export const trackingRouter = Router();

/**
 * Public endpoint — returns order tracking status by order number.
 * Deliberately omits trackingUrl so the Quikink URL is never sent to the client.
 */
trackingRouter.get(
  '/:orderNumber',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { orderNumber: req.params.orderNumber },
      select: {
        orderNumber: true,
        status: true,
        placedAt: true,
        shipment: {
          select: {
            courier: true,
            awbNumber: true,
            status: true,
            shippedAt: true,
            estimatedDeliveryAt: true,
            deliveredAt: true,
          },
        },
      },
    });
    if (!order) throw new NotFoundError('Order not found');
    res.json({ data: order });
  }),
);

/**
 * Server-side redirect to the courier tracking page.
 * The Quikink URL is fetched from the DB and sent as a 302 — it is never
 * included in any HTML or JSON response visible to the client.
 */
trackingRouter.get(
  '/:orderNumber/redirect',
  asyncHandler(async (req, res) => {
    const shipment = await prisma.shipment.findFirst({
      where: { order: { orderNumber: req.params.orderNumber } },
      select: { trackingUrl: true },
    });
    if (!shipment?.trackingUrl) throw new NotFoundError('Tracking link not available yet');
    res.redirect(302, shipment.trackingUrl);
  }),
);
