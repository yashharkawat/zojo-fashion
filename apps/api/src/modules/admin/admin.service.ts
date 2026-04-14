import { OrderStatus, ShipmentStatus, type Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { logger } from '../../config/logger';
import { refundPayment } from '../../lib/razorpay';
import { pushOrder } from '../../lib/printrove';
import { reconcileOrder } from '../printrove/printrove.webhook.service';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors';
import type {
  AdminListOrdersQuery,
  AdminUpdateOrderStatusBody,
  AdminAnalyticsQuery,
  AdminListProductsQuery,
} from './admin.schema';

// Allowed transitions. Admin has broader powers than users but still bounded.
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.PRINTING, OrderStatus.CANCELLED, OrderStatus.REFUNDED],
  PRINTING: [OrderStatus.SHIPPED, OrderStatus.CANCELLED, OrderStatus.REFUNDED],
  SHIPPED: [OrderStatus.DELIVERED, OrderStatus.REFUNDED],
  DELIVERED: [OrderStatus.REFUNDED],
  CANCELLED: [],
  REFUNDED: [],
};

export async function listOrders(q: AdminListOrdersQuery) {
  const where: Prisma.OrderWhereInput = {};
  if (q.status) where.status = q.status;
  if (q.userId) where.userId = q.userId;
  if (q.orderNumber) where.orderNumber = q.orderNumber;
  if (q.dateFrom || q.dateTo) {
    where.placedAt = {};
    if (q.dateFrom) (where.placedAt as Prisma.DateTimeFilter).gte = q.dateFrom;
    if (q.dateTo) (where.placedAt as Prisma.DateTimeFilter).lte = q.dateTo;
  }

  const [total, data] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { placedAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
        items: { select: { productTitle: true, variantLabel: true, quantity: true } },
        payment: { select: { status: true, method: true, razorpayPaymentId: true } },
        shipment: { select: { status: true, awbNumber: true, courier: true } },
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

export async function updateOrderStatus(
  adminUserId: string,
  orderId: string,
  input: AdminUpdateOrderStatusBody,
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true },
  });
  if (!order) throw new NotFoundError('Order not found');

  const allowed = ALLOWED_TRANSITIONS[order.status];
  if (!allowed.includes(input.status)) {
    throw new ConflictError(`Cannot transition from ${order.status} to ${input.status}`);
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: input.status,
        cancelledAt: input.status === OrderStatus.CANCELLED ? new Date() : order.cancelledAt,
        cancelledReason: input.status === OrderStatus.CANCELLED ? input.reason ?? null : order.cancelledReason,
      },
    });

    await tx.orderStatusEvent.create({
      data: {
        orderId,
        status: input.status,
        source: 'ADMIN',
        actorId: adminUserId,
        meta: input.reason ? { reason: input.reason } : undefined,
      },
    });

    // Shipment update
    if (input.status === OrderStatus.SHIPPED && input.trackingInfo) {
      await tx.shipment.upsert({
        where: { orderId },
        create: {
          orderId,
          courier: input.trackingInfo.courier,
          awbNumber: input.trackingInfo.awb,
          trackingUrl: input.trackingInfo.trackingUrl ?? null,
          status: ShipmentStatus.IN_TRANSIT,
          shippedAt: new Date(),
        },
        update: {
          courier: input.trackingInfo.courier,
          awbNumber: input.trackingInfo.awb,
          trackingUrl: input.trackingInfo.trackingUrl ?? null,
          status: ShipmentStatus.IN_TRANSIT,
          shippedAt: new Date(),
        },
      });
    }

    if (input.status === OrderStatus.DELIVERED) {
      await tx.shipment.updateMany({
        where: { orderId },
        data: { status: ShipmentStatus.DELIVERED, deliveredAt: new Date() },
      });
    }

    // Audit
    await tx.auditLog.create({
      data: {
        userId: adminUserId,
        action: `ORDER_STATUS_${input.status}`,
        entity: 'Order',
        entityId: orderId,
        diff: { from: order.status, to: input.status },
      },
    });

    return updated;
  });

  // Refund side-effect
  if (input.status === OrderStatus.REFUNDED && order.payment?.razorpayPaymentId) {
    refundPayment({
      razorpayPaymentId: order.payment.razorpayPaymentId,
      amountPaise: order.total,
      notes: { orderNumber: order.orderNumber, reason: input.reason ?? 'admin_refund' },
    })
      .then(async (r) => {
        await prisma.refund.create({
          data: {
            orderId,
            paymentId: order.payment!.id,
            razorpayRefundId: r.id,
            amount: order.total,
            status: 'PROCESSED',
            reason: input.reason ?? null,
            initiatedByAdminId: adminUserId,
          },
        });
      })
      .catch((err) => logger.error({ err, orderId }, 'Refund failed'));
  }

  return result;
}

export async function analytics(q: AdminAnalyticsQuery) {
  const to = q.to ?? new Date();
  const from = q.from ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  const where: Prisma.OrderWhereInput = { placedAt: { gte: from, lte: to } };
  const paidWhere: Prisma.OrderWhereInput = {
    ...where,
    status: { in: [OrderStatus.CONFIRMED, OrderStatus.PRINTING, OrderStatus.SHIPPED, OrderStatus.DELIVERED] },
  };

  const [
    totalOrders,
    paidOrders,
    cancelledOrders,
    refundedOrders,
    grossAgg,
    refundsAgg,
    topProducts,
    topSeries,
  ] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.count({ where: paidWhere }),
    prisma.order.count({ where: { ...where, status: OrderStatus.CANCELLED } }),
    prisma.order.count({ where: { ...where, status: OrderStatus.REFUNDED } }),
    prisma.order.aggregate({ where: paidWhere, _sum: { total: true } }),
    prisma.refund.aggregate({
      where: { createdAt: { gte: from, lte: to }, status: 'PROCESSED' },
      _sum: { amount: true },
    }),
    prisma.orderItem.groupBy({
      by: ['productTitle'],
      where: { order: paidWhere },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { lineTotal: 'desc' } },
      take: 10,
    }),
    prisma.$queryRaw<{ series: string; orders: bigint; revenue: bigint }[]>`
      SELECT p."animeSeries" AS series, COUNT(DISTINCT o.id)::bigint AS orders, SUM(oi."lineTotal")::bigint AS revenue
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      JOIN "ProductVariant" v ON v.id = oi."variantId"
      JOIN "Product" p ON p.id = v."productId"
      WHERE o."placedAt" BETWEEN ${from} AND ${to}
        AND o.status IN ('CONFIRMED','PRINTING','SHIPPED','DELIVERED')
        AND p."animeSeries" IS NOT NULL
      GROUP BY p."animeSeries"
      ORDER BY revenue DESC
      LIMIT 5
    `,
  ]);

  const gross = grossAgg._sum.total ?? 0;
  const refunds = refundsAgg._sum.amount ?? 0;

  return {
    range: { from, to },
    revenue: { gross, net: gross - refunds, refunds },
    orders: {
      total: totalOrders,
      paid: paidOrders,
      cancelled: cancelledOrders,
      refunded: refundedOrders,
    },
    aov: paidOrders > 0 ? Math.round(gross / paidOrders) : 0,
    topProducts: topProducts.map((t) => ({
      title: t.productTitle,
      unitsSold: t._sum?.quantity ?? 0,
      revenue: t._sum?.lineTotal ?? 0,
    })),
    topAnimeSeries: topSeries.map((t) => ({
      series: t.series,
      orders: Number(t.orders),
      revenue: Number(t.revenue),
    })),
  };
}

// ============================================================
// PRINTROVE RECOVERY — admin-triggered retry / reconcile / flag
// ============================================================

export async function retryPrintrove(adminUserId: string, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      user: { select: { firstName: true, email: true, phone: true } },
    },
  });
  if (!order) throw new NotFoundError('Order not found');
  if (order.printroveOrderId) {
    throw new ConflictError('Order already pushed to Printrove — use sync instead');
  }
  if (order.status !== OrderStatus.CONFIRMED && order.status !== OrderStatus.PENDING) {
    throw new ConflictError(`Cannot retry from status ${order.status}`);
  }

  const unmapped = order.items.filter((i) => !i.printroveSku);
  if (unmapped.length > 0) {
    throw new ValidationError(
      `${unmapped.length} item(s) missing Printrove mapping. Fix catalog then retry.`,
    );
  }

  const addr = order.shippingAddressSnapshot as {
    fullName: string; phone: string; line1: string; line2?: string;
    city: string; state: string; pincode: string; country: string;
  };

  try {
    const res = await pushOrder({
      externalOrderId: order.orderNumber,
      totalRupees: Math.round(order.total / 100),
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
    });

    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
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
          orderId: order.id,
          status: OrderStatus.PRINTING,
          source: 'ADMIN_RETRY',
          actorId: adminUserId,
          meta: { printroveOrderId: res.printroveOrderId },
        },
      }),
      prisma.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'PRINTROVE_RETRY',
          entity: 'Order',
          entityId: order.id,
          diff: { printroveOrderId: res.printroveOrderId },
        },
      }),
    ]);

    return { printroveOrderId: res.printroveOrderId, status: OrderStatus.PRINTING };
  } catch (err) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        printroveSyncStatus: 'FAILED',
        printroveRetryCount: { increment: 1 },
        printroveLastError: String(err).slice(0, 500),
      },
    });
    logger.error({ err, orderId }, 'Admin retry of Printrove push failed');
    throw err;
  }
}

export async function syncPrintrove(adminUserId: string, orderId: string) {
  const result = await reconcileOrder(orderId);
  await prisma.auditLog.create({
    data: {
      userId: adminUserId,
      action: 'PRINTROVE_SYNC',
      entity: 'Order',
      entityId: orderId,
      diff: result as unknown as Prisma.InputJsonValue,
    },
  });
  return result;
}

export async function markManualReview(adminUserId: string, orderId: string, note?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new NotFoundError('Order not found');

  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: {
        printroveSyncStatus: 'MANUAL_REVIEW',
        printroveLastError: note ? `[admin] ${note}` : order.printroveLastError,
        internalNotes: note
          ? `${order.internalNotes ?? ''}\n[${new Date().toISOString()}] ${note}`.trim()
          : order.internalNotes,
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'ORDER_MANUAL_REVIEW',
        entity: 'Order',
        entityId: orderId,
        diff: { note: note ?? null },
      },
    }),
  ]);
  return { ok: true };
}

export async function listProducts(q: AdminListProductsQuery) {
  const where: Prisma.ProductWhereInput = {};
  if (q.isActive !== undefined) where.isActive = q.isActive;
  if (q.printroveSyncStatus) where.printroveSyncStatus = q.printroveSyncStatus;
  if (q.categoryId) where.categoryId = q.categoryId;
  if (q.search) {
    where.OR = [
      { title: { contains: q.search, mode: 'insensitive' } },
      { slug: { contains: q.search, mode: 'insensitive' } },
    ];
  }

  const [total, data] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: {
        category: { select: { name: true, slug: true } },
        images: { where: { isPrimary: true }, take: 1 },
        _count: { select: { variants: true } },
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
