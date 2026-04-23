import { OrderStatus, type Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { logger } from '../../config/logger';
import { NotFoundError, ConflictError, ValidationError, ForbiddenError } from '../../lib/errors';
import { generateOrderNumber } from '../../utils/orderNumber';
import { computeGst, computeShipping } from '../../utils/money';
import { applyOrderCoupon } from '../../utils/orderCoupon';
import { refundPayment } from '../../lib/razorpay';
import type { CreateOrderBody, ListMyOrdersQuery } from './orders.schema';

const USER_CANCELLABLE: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.CONFIRMED];

export async function createOrder(userId: string, input: CreateOrderBody) {
  // Fetch address (must belong to user)
  const address = await prisma.address.findFirst({
    where: { id: input.shippingAddressId, userId },
  });
  if (!address) throw new NotFoundError('Shipping address not found');

  // Fetch variants (server-side pricing — never trust client)
  const variantIds = input.items.map((i) => i.variantId);
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds }, isActive: true, deletedAt: null },
    include: {
      product: {
        select: { id: true, title: true, basePrice: true, isActive: true, deletedAt: true, images: { where: { isPrimary: true }, take: 1 } },
      },
    },
  });

  if (variants.length !== variantIds.length) {
    throw new ValidationError('One or more variants unavailable');
  }

  for (const v of variants) {
    if (!v.product.isActive || v.product.deletedAt) {
      throw new ValidationError(`Product ${v.product.title} is no longer available`);
    }
  }

  // Build line items with server-side snapshots
  const itemRows = input.items.map((i) => {
    const v = variants.find((x) => x.id === i.variantId);
    if (!v) throw new ValidationError(`Variant ${i.variantId} missing`);
    const unitPrice = v.price > 0 ? v.price : v.product.basePrice;
    return {
      variant: v,
      quantity: i.quantity,
      unitPrice,
      lineTotal: unitPrice * i.quantity,
    };
  });

  const subtotal = itemRows.reduce((s, r) => s + r.lineTotal, 0);

  let discountAmount = 0;
  let couponCodeSnapshot: string | null = null;
  let freeShipping = false;
  if (input.couponCode) {
    const applied = applyOrderCoupon(input.couponCode, subtotal);
    discountAmount = applied.discountAmount;
    couponCodeSnapshot = applied.couponCode;
    freeShipping = applied.freeShipping;
  }

  const afterDiscount = subtotal - discountAmount;
  const shippingFee =
    freeShipping || afterDiscount <= 0 ? 0 : computeShipping(afterDiscount);
  const taxAmount = computeGst(afterDiscount, 0);
  const total = afterDiscount + shippingFee + taxAmount;

  const orderNumber = generateOrderNumber();

  const order = await prisma.order.create({
    data: {
      orderNumber,
      userId,
      subtotal,
      shippingFee,
      discountAmount,
      taxAmount,
      total,
      status: OrderStatus.PENDING,
      shippingAddressId: address.id,
      shippingAddressSnapshot: {
        fullName: address.fullName,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2,
        landmark: address.landmark,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        country: address.country,
      },
      couponCode: couponCodeSnapshot,
      notes: input.notes ?? null,
      items: {
        create: itemRows.map((r) => ({
          variantId: r.variant.id,
          productTitle: r.variant.product.title,
          variantLabel: `${r.variant.size} / ${r.variant.color}`,
          imageUrl: r.variant.product.images[0]?.url ?? null,
          sku: r.variant.sku,
          quantity: r.quantity,
          unitPrice: r.unitPrice,
          lineTotal: r.lineTotal,
        })),
      },
    },
    include: { items: true },
  });

  return order;
}

export async function listMy(userId: string, q: ListMyOrdersQuery) {
  const where: Prisma.OrderWhereInput = { userId };
  const [total, data] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { placedAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: {
        items: { select: { id: true, productTitle: true, variantLabel: true, imageUrl: true, quantity: true, unitPrice: true } },
        shipment: { select: { status: true, awbNumber: true, trackingUrl: true } },
      },
    }),
  ]);

  return {
    data,
    pagination: {
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.ceil(total / q.pageSize),
    },
  };
}

export async function getOne(userId: string, isAdmin: boolean, orderIdOrNumber: string) {
  const order = await prisma.order.findFirst({
    where: {
      OR: [{ id: orderIdOrNumber }, { orderNumber: orderIdOrNumber }],
    },
    include: {
      items: true,
      payment: true,
      shipment: true,
    },
  });
  if (!order) throw new NotFoundError('Order not found');
  if (!isAdmin && order.userId !== userId) throw new ForbiddenError('Not your order');
  return order;
}

export async function cancel(userId: string, orderId: string, reason?: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true },
  });
  if (!order) throw new NotFoundError('Order not found');
  if (order.userId !== userId) throw new ForbiddenError('Not your order');
  if (!USER_CANCELLABLE.includes(order.status)) {
    throw new ConflictError(`Cannot cancel order in status ${order.status}`);
  }

  const needsRefund = order.status === OrderStatus.CONFIRMED && order.payment?.status === 'CAPTURED';

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: needsRefund ? OrderStatus.REFUNDED : OrderStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelledReason: reason ?? null,
    },
  });

  // Fire-and-forget refund (in prod: enqueue to worker for reliability)
  if (needsRefund && order.payment?.razorpayPaymentId) {
    refundPayment({
      razorpayPaymentId: order.payment.razorpayPaymentId,
      amountPaise: order.total,
      notes: { orderNumber: order.orderNumber },
    }).catch((err) => {
      logger.error({ err, orderId }, 'Refund initiation failed');
    });
  }

  return updated;
}

// ============================================================
// RECEIPT — plain HTML (PDF generation in week 2)
// ============================================================

const inr = (paise: number): string => `₹${(paise / 100).toFixed(2)}`;

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function receipt(userId: string, orderId: string): Promise<string> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, payment: true, user: { select: { email: true } } },
  });
  if (!order) throw new NotFoundError('Order not found');
  if (order.userId !== userId) throw new ForbiddenError('Not your order');

  const addr = order.shippingAddressSnapshot as {
    fullName: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };

  const rows = order.items
    .map(
      (i) => `
      <tr>
        <td>${esc(i.productTitle)}</td>
        <td>${esc(i.variantLabel)}</td>
        <td class="r">${i.quantity}</td>
        <td class="r">${inr(i.unitPrice)}</td>
        <td class="r">${inr(i.lineTotal)}</td>
      </tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en"><head>
  <meta charset="utf-8">
  <title>Receipt ${esc(order.orderNumber)} — Zojo Fashion</title>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:2rem auto;padding:1rem;color:#1a1a1a}
    h1{margin:0 0 .25rem;color:#a855f7}
    table{width:100%;border-collapse:collapse;margin-top:.5rem}
    td,th{padding:.5rem .25rem;border-bottom:1px solid #eee;text-align:left;font-size:.9rem}
    th{background:#fafafa}
    .r{text-align:right}
    .total{font-weight:700;font-size:1.05rem;border-top:2px solid #1a1a1a}
    .muted{color:#666;font-size:.8rem;margin-top:2rem}
  </style>
</head><body>
  <h1>Zojo Fashion</h1>
  <p style="margin:0"><strong>Receipt:</strong> ${esc(order.orderNumber)}<br>
  <strong>Date:</strong> ${order.placedAt.toISOString().slice(0, 10)}<br>
  <strong>Payment:</strong> ${esc(order.payment?.method ?? 'N/A')}${
    order.payment?.razorpayPaymentId ? ` — ${esc(order.payment.razorpayPaymentId)}` : ''
  }</p>

  <h3>Ship to</h3>
  <p style="margin:0">${esc(addr.fullName)}<br>
  ${esc(addr.line1)}${addr.line2 ? `, ${esc(addr.line2)}` : ''}<br>
  ${esc(addr.city)}, ${esc(addr.state)} ${esc(addr.pincode)}</p>

  <h3>Items</h3>
  <table>
    <thead><tr><th>Item</th><th>Variant</th><th class="r">Qty</th><th class="r">Unit</th><th class="r">Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <table style="margin-top:1rem">
    <tr><td>Subtotal</td><td class="r">${inr(order.subtotal)}</td></tr>
    ${order.discountAmount ? `<tr><td>Discount${order.couponCode ? ` (${esc(order.couponCode)})` : ''}</td><td class="r">− ${inr(order.discountAmount)}</td></tr>` : ''}
    <tr><td>Delivery</td><td class="r">${order.shippingFee === 0 ? '—' : inr(order.shippingFee)}</td></tr>
    <tr class="total"><td>Total</td><td class="r">${inr(order.total)}</td></tr>
  </table>

  <p class="muted">System-generated receipt.<br>
  Zojo Fashion • zojofashion.com • support@zojofashion.com${
    order.gstin ? `<br>GSTIN: ${esc(order.gstin)}` : ''
  }</p>
</body></html>`;
}
