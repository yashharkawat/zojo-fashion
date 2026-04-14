import crypto from 'node:crypto';
import { OrderStatus, Prisma, ShipmentStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { logger } from '../../config/logger';
import { ValidationError } from '../../lib/errors';
import { printrove } from '../../lib/printrove';
import {
  notifyOrderShipped,
  notifyOrderDelivered,
  notifyOrderCancelled,
  type OrderNotificationContext,
} from '../../lib/notifications';
import type {
  PrintroveWebhookEvent,
  PrintroveWebhookEventType,
} from '../../types/printrove';

// ============================================================
// Status mapping — Printrove event → our enums
// ============================================================

interface StatusMapEntry {
  orderStatus: OrderStatus;
  shipmentStatus?: ShipmentStatus;
}

const STATUS_MAP: Record<PrintroveWebhookEventType, StatusMapEntry> = {
  'order.in_production':    { orderStatus: OrderStatus.PRINTING },
  'order.shipped':          { orderStatus: OrderStatus.SHIPPED,   shipmentStatus: ShipmentStatus.IN_TRANSIT },
  'order.out_for_delivery': { orderStatus: OrderStatus.SHIPPED,   shipmentStatus: ShipmentStatus.OUT_FOR_DELIVERY },
  'order.delivered':        { orderStatus: OrderStatus.DELIVERED, shipmentStatus: ShipmentStatus.DELIVERED },
  'order.cancelled':        { orderStatus: OrderStatus.CANCELLED },
  'order.rto':              { orderStatus: OrderStatus.CANCELLED, shipmentStatus: ShipmentStatus.RTO_INITIATED },
};

// ============================================================
// Entry point
// ============================================================

export async function handlePrintroveWebhook(params: {
  rawBody: string;
  signature: string;
  eventId: string | undefined;
}): Promise<{ applied: boolean; reason?: string }> {
  if (!printrove.verifyWebhookSignature(params.rawBody, params.signature)) {
    throw new ValidationError('Invalid Printrove webhook signature');
  }

  const event = JSON.parse(params.rawBody) as PrintroveWebhookEvent;
  const eventId = params.eventId ?? `${event.event}:${event.order_id}:${event.at}`;

  // Idempotency
  const claimed = await claimEvent(eventId, event.event, params.rawBody);
  if (!claimed) {
    logger.info({ eventId, type: event.event }, 'Printrove webhook duplicate — skipped');
    return { applied: false, reason: 'duplicate' };
  }

  // Exhaustive switch — TypeScript compiler enforces every event type
  switch (event.event) {
    case 'order.in_production':
      await applyStatus(event, STATUS_MAP[event.event]);
      break;
    case 'order.shipped':
      await applyShipped(event);
      break;
    case 'order.out_for_delivery':
      await applyOutForDelivery(event);
      break;
    case 'order.delivered':
      await applyDelivered(event);
      break;
    case 'order.cancelled':
      await applyCancelled(event);
      break;
    case 'order.rto':
      await applyRto(event);
      break;
    default: {
      // Type-level exhaustiveness check
      const _exhaustive: never = event;
      logger.warn({ event: _exhaustive }, 'Unhandled Printrove event type');
    }
  }

  return { applied: true };
}

// ============================================================
// Handlers per event
// ============================================================

async function applyStatus(
  event: Extract<PrintroveWebhookEvent, { event: 'order.in_production' }>,
  map: StatusMapEntry,
): Promise<void> {
  const order = await findOrder(event.order_id, event.external_order_id);
  if (!order) return;
  if (order.status === map.orderStatus) return;

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { status: map.orderStatus },
    }),
    prisma.orderStatusEvent.create({
      data: {
        orderId: order.id,
        status: map.orderStatus,
        source: 'PRINTROVE_WEBHOOK',
        meta: { event: event.event, at: event.at },
      },
    }),
  ]);
}

async function applyShipped(
  event: Extract<PrintroveWebhookEvent, { event: 'order.shipped' }>,
): Promise<void> {
  const order = await findOrder(event.order_id, event.external_order_id);
  if (!order) return;
  if (order.status === OrderStatus.SHIPPED || order.status === OrderStatus.DELIVERED) return;

  const shipment = event.shipment;

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.SHIPPED },
    }),
    prisma.shipment.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        courier: shipment.courier,
        courierServiceCode: shipment.courier_service_code,
        awbNumber: shipment.awb_number,
        trackingUrl: shipment.tracking_url,
        status: ShipmentStatus.IN_TRANSIT,
        shippedAt: shipment.shipped_at ? new Date(shipment.shipped_at) : new Date(),
        estimatedDeliveryAt: shipment.estimated_delivery_at
          ? new Date(shipment.estimated_delivery_at)
          : null,
        lastUpdateAt: new Date(),
        rawProviderPayload: event as unknown as Prisma.InputJsonValue,
      },
      update: {
        courier: shipment.courier,
        awbNumber: shipment.awb_number,
        trackingUrl: shipment.tracking_url,
        status: ShipmentStatus.IN_TRANSIT,
        shippedAt: shipment.shipped_at ? new Date(shipment.shipped_at) : new Date(),
        lastUpdateAt: new Date(),
        rawProviderPayload: event as unknown as Prisma.InputJsonValue,
      },
    }),
    prisma.orderStatusEvent.create({
      data: {
        orderId: order.id,
        status: OrderStatus.SHIPPED,
        source: 'PRINTROVE_WEBHOOK',
        meta: { awb: shipment.awb_number, courier: shipment.courier },
      },
    }),
  ]);

  // Customer notification (async, non-blocking — webhook must 200 fast)
  const ctx = await loadNotificationContext(order.id);
  if (ctx) {
    notifyOrderShipped({
      ...ctx,
      trackingUrl: shipment.tracking_url,
      courier: shipment.courier,
      awbNumber: shipment.awb_number,
    }).catch((err) => logger.error({ err }, 'notifyOrderShipped failed'));
  }
}

async function applyOutForDelivery(
  event: Extract<PrintroveWebhookEvent, { event: 'order.out_for_delivery' }>,
): Promise<void> {
  const order = await findOrder(event.order_id, event.external_order_id);
  if (!order) return;

  await prisma.shipment.updateMany({
    where: { orderId: order.id },
    data: { status: ShipmentStatus.OUT_FOR_DELIVERY, lastUpdateAt: new Date() },
  });
  await prisma.orderStatusEvent.create({
    data: {
      orderId: order.id,
      status: order.status,
      source: 'PRINTROVE_WEBHOOK',
      meta: { event: 'out_for_delivery', at: event.at },
    },
  });
}

async function applyDelivered(
  event: Extract<PrintroveWebhookEvent, { event: 'order.delivered' }>,
): Promise<void> {
  const order = await findOrder(event.order_id, event.external_order_id);
  if (!order) return;
  if (order.status === OrderStatus.DELIVERED) return;

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.DELIVERED },
    }),
    prisma.shipment.updateMany({
      where: { orderId: order.id },
      data: {
        status: ShipmentStatus.DELIVERED,
        deliveredAt: new Date(event.at),
        lastUpdateAt: new Date(),
      },
    }),
    prisma.orderStatusEvent.create({
      data: {
        orderId: order.id,
        status: OrderStatus.DELIVERED,
        source: 'PRINTROVE_WEBHOOK',
      },
    }),
  ]);

  const ctx = await loadNotificationContext(order.id);
  if (ctx) {
    notifyOrderDelivered(ctx).catch((err) =>
      logger.error({ err }, 'notifyOrderDelivered failed'),
    );
  }
}

async function applyCancelled(
  event: Extract<PrintroveWebhookEvent, { event: 'order.cancelled' }>,
): Promise<void> {
  const order = await findOrder(event.order_id, event.external_order_id);
  if (!order) return;
  if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.REFUNDED) return;

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledReason: event.reason ?? 'Printrove cancelled',
      },
    }),
    prisma.orderStatusEvent.create({
      data: {
        orderId: order.id,
        status: OrderStatus.CANCELLED,
        source: 'PRINTROVE_WEBHOOK',
        meta: { reason: event.reason },
      },
    }),
  ]);

  const ctx = await loadNotificationContext(order.id);
  if (ctx) {
    notifyOrderCancelled(ctx, event.reason).catch((err) =>
      logger.error({ err }, 'notifyOrderCancelled failed'),
    );
  }
  // TODO: trigger refund (Razorpay) if payment was captured — delegate to admin for MVP
}

async function applyRto(
  event: Extract<PrintroveWebhookEvent, { event: 'order.rto' }>,
): Promise<void> {
  const order = await findOrder(event.order_id, event.external_order_id);
  if (!order) return;

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.CANCELLED, cancelledReason: `RTO: ${event.reason ?? 'returned'}` },
    }),
    prisma.shipment.updateMany({
      where: { orderId: order.id },
      data: { status: ShipmentStatus.RTO_INITIATED, lastUpdateAt: new Date() },
    }),
    prisma.orderStatusEvent.create({
      data: {
        orderId: order.id,
        status: OrderStatus.CANCELLED,
        source: 'PRINTROVE_WEBHOOK',
        meta: { event: 'rto', reason: event.reason },
      },
    }),
  ]);
}

// ============================================================
// Helpers
// ============================================================

async function findOrder(printroveOrderId: string, externalOrderId: string) {
  // Prefer printroveOrderId lookup; fall back to our orderNumber for first-ever event
  const byPrintrove = await prisma.order.findUnique({
    where: { printroveOrderId },
  });
  if (byPrintrove) return byPrintrove;

  const byExternal = await prisma.order.findUnique({
    where: { orderNumber: externalOrderId },
  });
  if (byExternal && !byExternal.printroveOrderId) {
    // Backfill the link
    await prisma.order.update({
      where: { id: byExternal.id },
      data: { printroveOrderId, printroveSyncStatus: 'SYNCED', printroveLastSyncedAt: new Date() },
    });
  }
  return byExternal;
}

async function loadNotificationContext(orderId: string): Promise<OrderNotificationContext | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: { select: { firstName: true, email: true, phone: true } } },
  });
  if (!order) return null;
  return {
    orderNumber: order.orderNumber,
    customerName: order.user.firstName ?? 'there',
    customerEmail: order.user.email,
    customerPhone: order.user.phone,
    totalPaise: order.total,
  };
}

async function claimEvent(eventId: string, eventType: string, rawBody: string): Promise<boolean> {
  try {
    await prisma.processedWebhookEvent.create({
      data: {
        provider: 'PRINTROVE',
        eventId,
        eventType,
        payloadHash: crypto.createHash('sha256').update(rawBody).digest('hex'),
      },
    });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return false;
    }
    throw err;
  }
}

// ============================================================
// Polling / reconciliation (admin-triggered or cron)
// ============================================================

/**
 * Fetch current state from Printrove for a single order and reconcile our DB.
 * Used by admin "sync" endpoint and nightly cron.
 */
export async function reconcileOrder(orderId: string): Promise<{
  before: OrderStatus;
  after: OrderStatus;
  changed: boolean;
}> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !order.printroveOrderId) {
    throw new ValidationError('Order has no Printrove id; cannot reconcile');
  }

  const remote = await printrove.getOrder(order.printroveOrderId);

  // Synthesize a fake webhook event and apply it
  const synthesized: PrintroveWebhookEvent = remote.shipment
    ? {
        event: remote.status === 'delivered'
          ? 'order.delivered'
          : remote.status === 'shipped'
          ? 'order.shipped'
          : 'order.in_production',
        order_id: remote.order_id,
        external_order_id: remote.external_order_id,
        at: remote.updated_at,
        shipment: remote.shipment,
      } as PrintroveWebhookEvent
    : {
        event: remote.status === 'cancelled' ? 'order.cancelled' : 'order.in_production',
        order_id: remote.order_id,
        external_order_id: remote.external_order_id,
        at: remote.updated_at,
      } as PrintroveWebhookEvent;

  const before = order.status;

  // Apply via handler functions directly (skip signature/idempotency — internal call)
  switch (synthesized.event) {
    case 'order.shipped':       await applyShipped(synthesized); break;
    case 'order.delivered':     await applyDelivered(synthesized); break;
    case 'order.cancelled':     await applyCancelled(synthesized); break;
    case 'order.in_production': await applyStatus(synthesized, STATUS_MAP[synthesized.event]); break;
    default: break;
  }

  const refreshed = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
  const after = refreshed?.status ?? before;
  return { before, after, changed: before !== after };
}
