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

type RefundEventRow = {
  razorpayRefundId: string;
  amount: number;
  status: string;
  at: string;
};

function readRefundEvents(raw: Prisma.JsonValue | null | undefined): RefundEventRow[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      if (!x || typeof x !== 'object') return null;
      const o = x as Record<string, unknown>;
      if (typeof o.razorpayRefundId !== 'string' || typeof o.amount !== 'number') return null;
      return {
        razorpayRefundId: o.razorpayRefundId,
        amount: o.amount,
        status: typeof o.status === 'string' ? o.status : 'UNKNOWN',
        at: typeof o.at === 'string' ? o.at : new Date().toISOString(),
      };
    })
    .filter((x): x is RefundEventRow => x != null);
}

// ============================================================
// CREATE — prepaid (Razorpay) only
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

  return createRazorpayPayment(order);
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
    return { orderNumber: o.orderNumber };
  });

  scheduleOrderConfirmationEmail(payment.orderId);

  return { orderNumber, status: OrderStatus.CONFIRMED, alreadyCaptured: false };
}

/**
 * Fire-and-forget: email/SMS the customer that payment was received.
 */
function scheduleOrderConfirmationEmail(orderId: string): void {
  void (async () => {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
        items: { select: { productTitle: true, variantLabel: true, quantity: true } },
      },
    });
    if (!order) return;
    try {
      await notifyOrderConfirmed({
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: [order.user.firstName, order.user.lastName].filter(Boolean).join(' ') || 'there',
        customerEmail: order.user.email,
        customerPhone: order.user.phone,
        totalPaise: order.total,
        items: order.items,
      });
    } catch (err) {
      logger.error({ err, orderId }, 'notifyOrderConfirmationEmail failed');
    }
  })();
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

export async function handleRazorpayWebhook(params: {
  rawBody: string;
  signature: string;
  eventId: string | undefined;
}): Promise<{ applied: boolean; reason?: string }> {
  const valid = verifyWebhookSignature(params.rawBody, params.signature);
  if (!valid) throw new ValidationError('Invalid webhook signature');

  const event = JSON.parse(params.rawBody) as RazorpayWebhookEvent;

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
  ]);

  scheduleOrderConfirmationEmail(payment.orderId);
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
  const payment = await prisma.payment.findFirst({
    where: { razorpayPaymentId: r.payment_id },
  });
  if (!payment) {
    logger.warn({ payment_id: r.payment_id }, 'refund.processed: payment not found');
    return;
  }
  const events = readRefundEvents(payment.refundEvents);
  if (events.some((e) => e.razorpayRefundId === r.id)) {
    return;
  }
  const newEv: RefundEventRow = {
    razorpayRefundId: r.id,
    amount: r.amount,
    status: r.status,
    at: new Date().toISOString(),
  };
  const next = [...events, newEv];
  const totalRefunded = payment.amountRefunded + r.amount;
  const payStatus: PaymentStatus =
    totalRefunded >= payment.amount ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;
  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        amountRefunded: totalRefunded,
        lastRazorpayRefundId: r.id,
        refundEvents: next as unknown as Prisma.InputJsonValue,
        status: payStatus,
        rawWebhookPayload: r as unknown as Prisma.InputJsonValue,
      },
    }),
    ...(payStatus === PaymentStatus.REFUNDED
      ? [
          prisma.order.update({
            where: { id: payment.orderId },
            data: { status: OrderStatus.REFUNDED },
          }),
        ]
      : []),
  ]);
}

// ============================================================
// REFUND — admin-initiated
// ============================================================

export async function refund(_adminUserId: string, input: RefundPaymentBody) {
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
    const pay = order.payment!;
    const ev: RefundEventRow = {
      razorpayRefundId: rz.id,
      amount,
      status: rz.status ?? 'created',
      at: new Date().toISOString(),
    };
    const nextEvents = [...readRefundEvents(pay.refundEvents), ev];

    await tx.payment.update({
      where: { id: pay.id },
      data: {
        amountRefunded: { increment: amount },
        lastRazorpayRefundId: rz.id,
        refundEvents: nextEvents as unknown as Prisma.InputJsonValue,
        status: isFull ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
      },
    });

    if (isFull) {
      await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.REFUNDED } });
    }

    return { orderId: order.id, paymentId: pay.id, razorpayRefundId: rz.id, amount, isFull };
  });
}
