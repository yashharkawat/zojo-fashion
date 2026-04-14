import crypto from 'node:crypto';
import { OrderStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import {
  createRazorpayOrder,
  verifyCheckoutSignature,
  verifyWebhookSignature,
  refundPayment as gatewayRefund,
} from '../../lib/razorpay';
import { pushOrder } from '../../lib/printrove';
import { notifyOrderConfirmed } from '../../lib/notifications';
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
  ValidationError,
} from '../../lib/errors';
import type {
  CreatePaymentBody,
  VerifyPaymentBody,
  RefundPaymentBody,
  CreatePaymentResult,
} from './payments.schema';

const COD_MAX_PAISE = 500_000; // ₹5000 cap for COD

// ============================================================
// CREATE — entry point supporting both Razorpay and COD flows
// ============================================================

export async function createPayment(
  userId: string,
  input: CreatePaymentBody,
): Promise<CreatePaymentResult> {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: {
      payment: true,
      user: { select: { firstName: true, email: true, phone: true } },
    },
  });

  if (!order) throw new NotFoundError('Order not found');
  if (order.userId !== userId) throw new ForbiddenError('Not your order');
  if (order.status !== OrderStatus.PENDING) {
    throw new ConflictError(`Order is in status ${order.status}, cannot create payment`);
  }
  if (order.payment && order.payment.status === PaymentStatus.CAPTURED) {
    throw new ConflictError('Order already paid');
  }

  if (input.method === 'COD') {
    return createCodPayment(userId, order);
  }
  return createRazorpayPayment(order);
}

async function createCodPayment(
  userId: string,
  order: Awaited<ReturnType<typeof prisma.order.findUnique>> & { user: { firstName: string | null; email: string; phone: string | null } },
): Promise<CreatePaymentResult> {
  if (!order) throw new NotFoundError();

  if (order.total > COD_MAX_PAISE) {
    throw new ValidationError(`COD not available for orders above ₹${COD_MAX_PAISE / 100}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        razorpayOrderId: `COD_${order.orderNumber}`, // sentinel, unique
        razorpayReceipt: order.orderNumber,
        amount: order.total,
        method: PaymentMethod.COD,
        status: PaymentStatus.CAPTURED,
        capturedAt: new Date(),
      },
      update: {
        method: PaymentMethod.COD,
        status: PaymentStatus.CAPTURED,
        capturedAt: new Date(),
      },
    });
    await tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.CONFIRMED },
    });
    await tx.orderStatusEvent.create({
      data: {
        orderId: order.id,
        status: OrderStatus.CONFIRMED,
        source: 'COD',
        actorId: userId,
      },
    });
  });

  // Background Printrove push
  pushToPrintroveBackground(order.id).catch((err) =>
    logger.error({ err, orderId: order.id }, 'Printrove push (COD) failed'),
  );

  return {
    method: 'COD',
    orderNumber: order.orderNumber,
    status: 'CONFIRMED',
  };
}

async function createRazorpayPayment(
  order: NonNullable<Awaited<ReturnType<typeof prisma.order.findUnique>>> & { user: { firstName: string | null; email: string; phone: string | null } },
): Promise<CreatePaymentResult> {
  const rzOrder = await createRazorpayOrder({
    amountPaise: order.total,
    receipt: order.orderNumber,
    notes: { orderId: order.id, userId: order.userId },
  });

  await prisma.payment.upsert({
    where: { orderId: order.id },
    create: {
      orderId: order.id,
      razorpayOrderId: rzOrder.id,
      razorpayReceipt: order.orderNumber,
      amount: order.total,
      status: PaymentStatus.CREATED,
      rawCreatePayload: rzOrder as unknown as Prisma.InputJsonValue,
    },
    update: {
      razorpayOrderId: rzOrder.id,
      amount: order.total,
      status: PaymentStatus.CREATED,
      rawCreatePayload: rzOrder as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    method: 'RAZORPAY',
    razorpayOrderId: rzOrder.id,
    amount: rzOrder.amount,
    currency: 'INR',
    keyId: env.RAZORPAY_KEY_ID,
    orderNumber: order.orderNumber,
    prefill: {
      name: order.user.firstName ?? '',
      email: order.user.email,
      contact: order.user.phone ?? '',
    },
  };
}

// ============================================================
// VERIFY — client-side signature verification
// ============================================================

export async function verifyPayment(userId: string, input: VerifyPaymentBody) {
  const payment = await prisma.payment.findUnique({
    where: { razorpayOrderId: input.razorpay_order_id },
    include: { order: true },
  });
  if (!payment) throw new NotFoundError('Payment not found');
  if (payment.order.userId !== userId) throw new ForbiddenError('Not your payment');

  const valid = verifyCheckoutSignature({
    razorpayOrderId: input.razorpay_order_id,
    razorpayPaymentId: input.razorpay_payment_id,
    signature: input.razorpay_signature,
  });

  if (!valid) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
        failureReason: 'Signature mismatch',
        failedAt: new Date(),
      },
    });
    throw new ValidationError('Invalid payment signature');
  }

  // Idempotent: webhook may have already captured
  if (payment.status === PaymentStatus.CAPTURED) {
    return {
      orderNumber: payment.order.orderNumber,
      status: payment.order.status,
      alreadyCaptured: true,
    };
  }

  const { orderNumber } = await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        razorpayPaymentId: input.razorpay_payment_id,
        razorpaySignature: input.razorpay_signature,
        status: PaymentStatus.CAPTURED,
        capturedAt: new Date(),
        rawVerifyPayload: input as unknown as Prisma.InputJsonValue,
      },
    });
    const o = await tx.order.update({
      where: { id: payment.orderId },
      data: { status: OrderStatus.CONFIRMED },
    });
    await tx.orderStatusEvent.create({
      data: {
        orderId: payment.orderId,
        status: OrderStatus.CONFIRMED,
        source: 'RAZORPAY_VERIFY',
        meta: { paymentId: input.razorpay_payment_id },
      },
    });
    return { orderNumber: o.orderNumber };
  });

  pushToPrintroveBackground(payment.orderId).catch((err) =>
    logger.error({ err, orderId: payment.orderId }, 'Printrove push failed'),
  );

  return { orderNumber, status: OrderStatus.CONFIRMED, alreadyCaptured: false };
}

// ============================================================
// PRINTROVE PUSH — background (in MVP runs inline; move to queue later)
// ============================================================

async function pushToPrintroveBackground(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      user: { select: { firstName: true, email: true, phone: true } },
    },
  });
  if (!order || order.printroveOrderId) return;

  const addr = order.shippingAddressSnapshot as {
    fullName: string; phone: string; line1: string; line2?: string;
    city: string; state: string; pincode: string; country: string;
  };

  // Validate every item has a Printrove mapping — fail fast for easy admin triage
  const unmapped = order.items.filter((i) => !i.printroveSku);
  if (unmapped.length > 0) {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        printroveSyncStatus: 'MANUAL_REVIEW',
        printroveLastError: `Missing Printrove mapping for ${unmapped.length} item(s)`,
      },
    });
    logger.error(
      { orderId, unmappedCount: unmapped.length },
      'Order has items without Printrove mapping — marked for manual review',
    );
    return;
  }

  try {
    const isCod = order.status === OrderStatus.CONFIRMED && (await isCodOrder(orderId));
    const res = await pushOrder({
      externalOrderId: order.orderNumber,
      totalRupees: Math.round(order.total / 100), // paise → rupees for Printrove
      items: order.items.map((i) => ({
        printroveVariantId: i.printroveSku!,
        quantity: i.quantity,
      })),
      shippingAddress: addr,
      customer: {
        name: order.user.firstName ?? addr.fullName,
        email: order.user.email,
        phone: order.user.phone ?? addr.phone,
      },
      isCod,
    });

    await prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.PRINTING,
          printroveOrderId: res.printroveOrderId,
          printroveSyncStatus: 'SYNCED',
          printroveLastSyncedAt: new Date(),
          printroveLastError: null,
        },
      }),
      prisma.orderStatusEvent.create({
        data: {
          orderId,
          status: OrderStatus.PRINTING,
          source: 'PRINTROVE_PUSH',
          meta: { printroveOrderId: res.printroveOrderId },
        },
      }),
    ]);

    // Fire customer notification — non-blocking
    notifyOrderConfirmed({
      orderNumber: order.orderNumber,
      customerName: order.user.firstName ?? 'there',
      customerEmail: order.user.email,
      customerPhone: order.user.phone,
      totalPaise: order.total,
    }).catch((err) => logger.error({ err, orderId }, 'notifyOrderConfirmed failed'));
  } catch (err) {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        printroveSyncStatus: 'FAILED',
        printroveRetryCount: { increment: 1 },
        printroveLastError: String(err).slice(0, 500),
      },
    });
    throw err;
  }
}

async function isCodOrder(orderId: string): Promise<boolean> {
  const p = await prisma.payment.findUnique({
    where: { orderId },
    select: { method: true },
  });
  return p?.method === PaymentMethod.COD;
}

// ============================================================
// WEBHOOK — idempotent, source of truth
// ============================================================

interface RazorpayWebhookEvent {
  id: string;
  event: string;
  payload: {
    payment?: { entity: RazorpayPaymentEntity };
    refund?: { entity: RazorpayRefundEntity };
  };
}

interface RazorpayPaymentEntity {
  id: string;
  order_id: string;
  method?: string;
  status: string;
  amount: number;
  bank?: string;
  wallet?: string;
  vpa?: string;
  card?: { last4?: string; network?: string };
  error_reason?: string;
}

interface RazorpayRefundEntity {
  id: string;
  payment_id: string;
  amount: number;
  status: string;
}

/** Map Razorpay method string to our enum. */
function mapMethod(m?: string): PaymentMethod | null {
  if (!m) return null;
  const map: Record<string, PaymentMethod> = {
    upi: PaymentMethod.UPI,
    card: PaymentMethod.CARD,
    netbanking: PaymentMethod.NETBANKING,
    wallet: PaymentMethod.WALLET,
    emi: PaymentMethod.EMI,
  };
  return map[m.toLowerCase()] ?? PaymentMethod.OTHER;
}

/**
 * Try to record processed event; returns true if this is first-seen, false if duplicate.
 */
async function claimEvent(eventId: string, eventType: string, rawBody: string): Promise<boolean> {
  try {
    await prisma.processedWebhookEvent.create({
      data: {
        provider: 'RAZORPAY',
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

export async function handleRazorpayWebhook(params: {
  rawBody: string;
  signature: string;
  eventId: string | undefined;
}): Promise<{ applied: boolean; reason?: string }> {
  const valid = verifyWebhookSignature(params.rawBody, params.signature);
  if (!valid) throw new ValidationError('Invalid webhook signature');

  const event = JSON.parse(params.rawBody) as RazorpayWebhookEvent;
  const eventId = params.eventId ?? event.id;
  if (!eventId) throw new ValidationError('Missing event id');

  const firstSeen = await claimEvent(eventId, event.event, params.rawBody);
  if (!firstSeen) {
    logger.info({ eventId, type: event.event }, 'Webhook duplicate — skipped');
    return { applied: false, reason: 'duplicate' };
  }

  switch (event.event) {
    case 'payment.captured':
      await applyPaymentCaptured(event.payload.payment!.entity);
      break;
    case 'payment.failed':
      await applyPaymentFailed(event.payload.payment!.entity);
      break;
    case 'refund.processed':
      await applyRefundProcessed(event.payload.refund!.entity);
      break;
    default:
      logger.info({ event: event.event }, 'Unhandled webhook event type');
  }

  return { applied: true };
}

async function applyPaymentCaptured(p: RazorpayPaymentEntity): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { razorpayOrderId: p.order_id },
    include: { order: true },
  });
  if (!payment) {
    logger.warn({ order_id: p.order_id }, 'Webhook for unknown payment');
    return;
  }
  if (payment.status === PaymentStatus.CAPTURED) return; // already handled

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        razorpayPaymentId: p.id,
        status: PaymentStatus.CAPTURED,
        capturedAt: new Date(),
        method: mapMethod(p.method) ?? payment.method,
        bank: p.bank ?? null,
        wallet: p.wallet ?? null,
        vpa: p.vpa ?? null,
        cardLast4: p.card?.last4 ?? null,
        cardNetwork: p.card?.network ?? null,
        rawWebhookPayload: p as unknown as Prisma.InputJsonValue,
      },
    }),
    prisma.order.update({
      where: { id: payment.orderId },
      data: { status: OrderStatus.CONFIRMED },
    }),
    prisma.orderStatusEvent.create({
      data: {
        orderId: payment.orderId,
        status: OrderStatus.CONFIRMED,
        source: 'RAZORPAY_WEBHOOK',
        meta: { paymentId: p.id },
      },
    }),
  ]);

  pushToPrintroveBackground(payment.orderId).catch((err) =>
    logger.error({ err }, 'Printrove push from webhook failed'),
  );
}

async function applyPaymentFailed(p: RazorpayPaymentEntity): Promise<void> {
  await prisma.payment.updateMany({
    where: { razorpayOrderId: p.order_id },
    data: {
      status: PaymentStatus.FAILED,
      failedAt: new Date(),
      failureReason: p.error_reason ?? 'Gateway failure',
      rawWebhookPayload: p as unknown as Prisma.InputJsonValue,
    },
  });
}

async function applyRefundProcessed(r: RazorpayRefundEntity): Promise<void> {
  await prisma.refund.updateMany({
    where: { razorpayRefundId: r.id },
    data: {
      status: 'PROCESSED',
      processedAt: new Date(),
      rawProviderPayload: r as unknown as Prisma.InputJsonValue,
    },
  });
}

// ============================================================
// REFUND — admin-initiated
// ============================================================

export async function refund(adminUserId: string, input: RefundPaymentBody) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { payment: true },
  });
  if (!order) throw new NotFoundError('Order not found');
  if (!order.payment) throw new ConflictError('No payment on this order');
  if (order.payment.status !== PaymentStatus.CAPTURED &&
      order.payment.status !== PaymentStatus.PARTIALLY_REFUNDED) {
    throw new ConflictError(`Payment status ${order.payment.status} not refundable`);
  }
  if (order.payment.method === PaymentMethod.COD) {
    throw new ConflictError('COD orders must be refunded manually (cash)');
  }
  if (!order.payment.razorpayPaymentId) {
    throw new ConflictError('Missing Razorpay payment id');
  }

  const refundable = order.payment.amount - order.payment.amountRefunded;
  const amount = input.amount ?? refundable;
  if (amount <= 0 || amount > refundable) {
    throw new ValidationError(`Refund amount must be between 1 and ${refundable} paise`);
  }
  const isFull = amount === refundable;

  // Call gateway (outside the transaction — external side effect)
  const rz = await gatewayRefund({
    razorpayPaymentId: order.payment.razorpayPaymentId,
    amountPaise: amount,
    notes: { orderNumber: order.orderNumber, reason: input.reason ?? 'admin_refund' },
  });

  return prisma.$transaction(async (tx) => {
    const refundRow = await tx.refund.create({
      data: {
        orderId: order.id,
        paymentId: order.payment!.id,
        razorpayRefundId: rz.id,
        amount,
        status: rz.status === 'processed' ? 'PROCESSED' : 'PENDING',
        reason: input.reason ?? null,
        initiatedByAdminId: adminUserId,
        processedAt: rz.status === 'processed' ? new Date() : null,
      },
    });

    await tx.payment.update({
      where: { id: order.payment!.id },
      data: {
        amountRefunded: { increment: amount },
        status: isFull ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
      },
    });

    if (isFull) {
      await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.REFUNDED } });
      await tx.orderStatusEvent.create({
        data: {
          orderId: order.id,
          status: OrderStatus.REFUNDED,
          source: 'ADMIN',
          actorId: adminUserId,
          meta: { refundId: rz.id, amount },
        },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: adminUserId,
        action: isFull ? 'ORDER_REFUND_FULL' : 'ORDER_REFUND_PARTIAL',
        entity: 'Order',
        entityId: order.id,
        diff: { amount, razorpayRefundId: rz.id, reason: input.reason },
      },
    });

    return refundRow;
  });
}
