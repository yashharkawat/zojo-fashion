import nodemailer from 'nodemailer';
import { OrderStatus, PaymentStatus, ShipmentStatus, type Prisma } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import { prisma } from '../../config/prisma';
import { logger } from '../../config/logger';
import { refundPayment } from '../../lib/razorpay';
import { ConflictError, NotFoundError } from '../../lib/errors';
import { detectPairs } from '../../lib/colorDetect';
import { colorNameToSlug } from '../../lib/colorPalette';
import { notifyOrderShipped, notifyOrderDelivered } from '../../lib/notifications';
import type {
  AdminListOrdersQuery,
  AdminUpdateOrderStatusBody,
  AdminAnalyticsQuery,
  AdminListProductsQuery,
  QuickCreateProductInput,
} from './admin.schema';

// ── Cloudinary singleton config ───────────────────────────────────────────────
if (process.env.CLOUDINARY_URL) {
  cloudinary.config(true);
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

async function uploadBufferToCloudinary(
  buffer: Buffer,
  publicId: string,
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        folder: 'zojo-catalog',
        format: 'webp',
        quality: 'auto',
        overwrite: true,
        resource_type: 'image',
      },
      (err, result) => {
        if (err || !result) return reject(err ?? new Error('Cloudinary upload failed'));
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    uploadStream.end(buffer);
  });
}

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

export async function getOrderDetail(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
      items: { select: { productTitle: true, variantLabel: true, quantity: true, lineTotal: true } },
      payment: { select: { status: true, method: true, razorpayPaymentId: true } },
      shipment: { select: { status: true, awbNumber: true, courier: true, trackingUrl: true } },
    },
  });
  if (!order) throw new NotFoundError('Order not found');
  return order;
}

export async function updateOrderStatus(
  _adminUserId: string,
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
        const pay = order.payment!;
        const raw = pay.refundEvents;
        const prev = Array.isArray(raw) ? raw : [];
        const ev = {
          razorpayRefundId: r.id,
          amount: order.total,
          status: 'processed',
          at: new Date().toISOString(),
        };
        await prisma.payment.update({
          where: { id: pay.id },
          data: {
            amountRefunded: { increment: order.total },
            lastRazorpayRefundId: r.id,
            refundEvents: [...prev, ev] as unknown as Prisma.InputJsonValue,
            status: PaymentStatus.REFUNDED,
          },
        });
      })
      .catch((err) => logger.error({ err, orderId }, 'Refund failed'));
  }

  // Post-transition notifications — fire-and-forget after transaction commits
  if (input.status === OrderStatus.SHIPPED || input.status === OrderStatus.DELIVERED) {
    const fullOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
        shipment: { select: { trackingUrl: true, awbNumber: true, courier: true } },
        items: { select: { productTitle: true, variantLabel: true, quantity: true } },
      },
    });
    if (fullOrder?.user) {
      const ctx = {
        orderId: fullOrder.id,
        orderNumber: fullOrder.orderNumber,
        customerName: [fullOrder.user.firstName, fullOrder.user.lastName].filter(Boolean).join(' ') || 'Customer',
        customerEmail: fullOrder.user.email,
        customerPhone: fullOrder.user.phone,
        totalPaise: fullOrder.total,
        trackingUrl: fullOrder.shipment?.trackingUrl ?? undefined,
        courier: fullOrder.shipment?.courier ?? undefined,
        awbNumber: fullOrder.shipment?.awbNumber ?? undefined,
        items: fullOrder.items,
      };
      if (input.status === OrderStatus.SHIPPED && input.trackingInfo) {
        notifyOrderShipped(ctx).catch((err) =>
          logger.error({ err, orderId }, 'notifyOrderShipped failed'),
        );
      }
      if (input.status === OrderStatus.DELIVERED) {
        notifyOrderDelivered(ctx).catch((err) =>
          logger.error({ err, orderId }, 'notifyOrderDelivered failed'),
        );
      }
    }
  }

  return result;
}

export async function resendShippingNotification(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { firstName: true, lastName: true, email: true, phone: true } },
      shipment: { select: { trackingUrl: true, awbNumber: true, courier: true } },
      items: { select: { productTitle: true, variantLabel: true, quantity: true } },
    },
  });
  if (!order) throw new NotFoundError('Order not found');
  if (order.status !== 'SHIPPED' && order.status !== 'DELIVERED') {
    throw new ConflictError('Order is not in a shipped state');
  }
  if (!order.user) throw new NotFoundError('Order has no associated user');

  const ctx = {
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerName: [order.user.firstName, order.user.lastName].filter(Boolean).join(' ') || 'Customer',
    customerEmail: order.user.email,
    customerPhone: order.user.phone,
    totalPaise: order.total,
    trackingUrl: order.shipment?.trackingUrl ?? undefined,
    courier: order.shipment?.courier ?? undefined,
    awbNumber: order.shipment?.awbNumber ?? undefined,
    items: order.items,
  };

  // Verify SMTP connection before sending so errors surface to the admin UI
  const gUser = process.env.GMAIL_USER;
  const gPass = process.env.GMAIL_APP_PASSWORD;
  if (!gUser || !gPass) {
    throw new ConflictError('GMAIL_USER or GMAIL_APP_PASSWORD not set on this server');
  }
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: gUser, pass: gPass },
    tls: { rejectUnauthorized: false },
  });
  await transporter.verify().catch((err: Error) => {
    throw new ConflictError(`Gmail SMTP error: ${err.message}`);
  });

  await notifyOrderShipped(ctx);
  logger.info({ orderId, email: ctx.customerEmail }, 'Tracking email resent');
  return { ok: true, sentTo: ctx.customerEmail };
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
    prisma.payment.aggregate({
      where: {
        amountRefunded: { gt: 0 },
        order: { placedAt: { gte: from, lte: to } },
      },
      _sum: { amountRefunded: true },
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
  const refunds = refundsAgg._sum.amountRefunded ?? 0;

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

export async function markManualReview(_adminUserId: string, orderId: string, note?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new NotFoundError('Order not found');

  await prisma.order.update({
    where: { id: orderId },
    data: {
      internalNotes: note
        ? `${order.internalNotes ?? ''}\n[${new Date().toISOString()}] ${note}`.trim()
        : order.internalNotes,
    },
  });
  return { ok: true };
}

export async function setDefaultColor(productId: string, color: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new NotFoundError('Product not found');

  await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id: productId }, data: { defaultColor: color } });
    // Reset isPrimary, then flag the front image of the chosen color.
    await tx.productImage.updateMany({ where: { productId }, data: { isPrimary: false } });
    await tx.productImage.updateMany({
      where: { productId, variantColor: color, url: { endsWith: '/front.webp' } },
      data: { isPrimary: true },
    });
  });

  return { ok: true, defaultColor: color };
}

export async function quickCreateProduct(
  input: QuickCreateProductInput,
  files: Array<{ buffer: Buffer; originalname: string }>,
) {
  // 1. Detect color pairs from uploaded images (grouped by filename colorId)
  const rawFiles = files.map((f) => ({ buffer: f.buffer, name: f.originalname }));
  const pairs = await detectPairs(rawFiles);

  if (pairs.length === 0) {
    throw new ConflictError('Could not detect any color pairs from the uploaded files.');
  }


  const slug = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  // Ensure unique slug
  const existing = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
  const finalSlug = existing ? `${slug}-${Date.now()}` : slug;
  const defaultColor = pairs[0]!.color.name;

  // 2. Upload to Cloudinary
  const imageRows: Array<{
    url: string;
    publicId: string;
    alt: string;
    sortOrder: number;
    isPrimary: boolean;
    variantColor: string;
  }> = [];

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i]!;
    const colorSlug = colorNameToSlug(pair.color.name);
    const pfx = `${finalSlug}/${colorSlug}`;

    const [back, front] = await Promise.all([
      uploadBufferToCloudinary(pair.backBuffer, `${pfx}/back`),
      uploadBufferToCloudinary(pair.frontBuffer, `${pfx}/front`),
    ]);

    imageRows.push(
      {
        url: back.url,
        publicId: back.publicId,
        alt: `${input.title} — ${pair.color.name} back`,
        sortOrder: i * 2,
        isPrimary: false,
        variantColor: pair.color.name,
      },
      {
        url: front.url,
        publicId: front.publicId,
        alt: `${input.title} — ${pair.color.name} front`,
        sortOrder: i * 2 + 1,
        isPrimary: pair.color.name === defaultColor,
        variantColor: pair.color.name,
      },
    );
  }

  // 3. Get size chart for category
  const sizeChart = await prisma.sizeChart.findUnique({ where: { name: input.categorySlug } });
  const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

  // Short unique ID per product so SKUs never collide even when title/slug is reused
  const skuId = Math.random().toString(36).slice(2, 8).toUpperCase();

  const variantRows = SIZES.flatMap((size, si) =>
    pairs.map((pair, ci) => ({
      sku: `ZJ-${skuId}-C${ci}-${size}`,
      size,
      color: pair.color.name,
      colorHex: pair.color.hex,
      price: input.basePrice,
      stock: si === SIZES.length - 1 ? 3 : 50,
      isActive: true,
    })),
  );

  // 4. Create product
  const product = await prisma.product.create({
    data: {
      slug: finalSlug,
      title: input.title,
      description: input.description,
      shortDescription: input.description.slice(0, 100) + '...',
      categorySlug: input.categorySlug,
      basePrice: input.basePrice,
      compareAtPrice: input.compareAtPrice ?? null,
      defaultColor,
      gender: 'MEN',
      animeSeries: input.animeSeries ?? null,
      tags: input.tags ?? [],
      material: input.material ?? null,
      isActive: true,
      isFeatured: true,
      metaTitle: input.title,
      metaDescription: input.description.slice(0, 155),
      ...(sizeChart ? { sizeChartId: sizeChart.id } : {}),
      images: { create: imageRows },
      variants: { create: variantRows },
    },
    include: {
      images: true,
      variants: { select: { id: true, sku: true, color: true, size: true } },
    },
  });

  logger.info({ productId: product.id, slug: finalSlug, colors: pairs.length }, 'Quick-created product');
  return product;
}

export async function listProducts(q: AdminListProductsQuery) {
  const where: Prisma.ProductWhereInput = {};
  if (q.isActive !== undefined) where.isActive = q.isActive;
  if (q.categorySlug) where.categorySlug = q.categorySlug;
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
        images: { where: { isPrimary: true }, take: 1 },
        _count: { select: { variants: true } },
        variants: {
          where: { isActive: true },
          select: { color: true, colorHex: true },
          distinct: ['color'],
          orderBy: { color: 'asc' },
        },
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
