import nodemailer from 'nodemailer';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';

/**
 * Notification dispatcher. MVP: logs + no-ops when provider keys are absent.
 * Wire to Resend (email) + MSG91 (SMS) when production-ready.
 *
 * Each method is idempotent by caller responsibility; dedupe happens at the
 * call site (e.g., via notification_events table — TODO week 2).
 */

// ──────────────── Types ────────────────

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tags?: Record<string, string>;
}

export interface SmsPayload {
  to: string;       // E.164: +91XXXXXXXXXX
  body: string;     // < 160 chars recommended
  flowId?: string;  // MSG91 flow id for templated messages
}

export interface NotificationResult {
  ok: boolean;
  providerId?: string;
  reason?: string;
}

// ──────────────── Email ────────────────

export async function sendEmail(payload: EmailPayload): Promise<NotificationResult> {
  const gUser = process.env.GMAIL_USER;
  const gPass = process.env.GMAIL_APP_PASSWORD;
  if (gUser && gPass) {
    try {
      // Use explicit SMTP settings (port 587 + STARTTLS) instead of service:'gmail'
      // which is more reliable on cloud providers like Railway
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: { user: gUser, pass: gPass },
        tls: { rejectUnauthorized: false },
      });
      const from = process.env.EMAIL_FROM ?? `Zojo Fashion <${gUser}>`;
      const sent = await transporter.sendMail({
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });
      logger.info({ to: payload.to, messageId: sent.messageId }, 'Email sent via Gmail');
      return { ok: true, providerId: sent.messageId };
    } catch (err) {
      logger.error({ err, to: payload.to }, 'Gmail send failed');
      return { ok: false, reason: err instanceof Error ? err.message : 'gmail error' };
    }
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    logger.info(
      { to: payload.to, subject: payload.subject },
      '[email:stub] set GMAIL_USER+GMAIL_APP_PASSWORD or RESEND_API_KEY',
    );
    return { ok: true, reason: 'stubbed (no GMAIL or RESEND configured)' };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Zojo Fashion <orders@zojofashion.com>',
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        tags: payload.tags
          ? Object.entries(payload.tags).map(([name, value]) => ({ name, value }))
          : undefined,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      logger.error({ status: res.status, body }, 'Email send failed');
      return { ok: false, reason: `resend ${res.status}` };
    }
    const out = (await res.json()) as { id: string };
    return { ok: true, providerId: out.id };
  } catch (err) {
    logger.error({ err }, 'Email send exception');
    return { ok: false, reason: err instanceof Error ? err.message : 'unknown' };
  }
}

// ──────────────── SMS ────────────────

export async function sendSms(payload: SmsPayload): Promise<NotificationResult> {
  const key = process.env.MSG91_AUTH_KEY;
  if (!key) {
    logger.info({ to: payload.to, body: payload.body.slice(0, 80) }, '[sms:stub] would send');
    return { ok: true, reason: 'stubbed (MSG91_AUTH_KEY not set)' };
  }
  try {
    // MSG91 flow API — adjust to their current endpoint at integration time
    const res = await fetch('https://control.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: { authkey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flow_id: payload.flowId,
        sender: 'ZOJOFS',
        recipients: [{ mobiles: payload.to.replace(/^\+/, ''), body: payload.body }],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      logger.error({ status: res.status, body }, 'SMS send failed');
      return { ok: false, reason: `msg91 ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    logger.error({ err }, 'SMS send exception');
    return { ok: false, reason: err instanceof Error ? err.message : 'unknown' };
  }
}

// ──────────────── Composite "order events" ────────────────

export interface OrderNotificationContext {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  totalPaise: number;
  trackingUrl?: string;
  courier?: string;
  awbNumber?: string;
  items?: Array<{ productTitle: string; variantLabel: string; quantity: number }>;
}

const inr = (p: number): string => `₹${(p / 100).toFixed(0)}`;

export async function notifyOrderConfirmed(ctx: OrderNotificationContext): Promise<void> {
  await Promise.allSettled([
    sendEmail({
      to: ctx.customerEmail,
      subject: `Order ${ctx.orderNumber} confirmed — Zojo Fashion`,
      html: `
        <h2>Thanks, ${escapeHtml(ctx.customerName)}!</h2>
        <p>Your order <strong>${ctx.orderNumber}</strong> (${inr(ctx.totalPaise)}) is confirmed.</p>
        <p>We'll email you when it ships.</p>
      `,
      tags: { type: 'order_confirmed', orderNumber: ctx.orderNumber },
    }),
    ctx.customerPhone
      ? sendSms({
          to: ctx.customerPhone,
          body: `Zojo Fashion: order ${ctx.orderNumber} confirmed (${inr(ctx.totalPaise)}). We'll text you when it ships.`,
        })
      : Promise.resolve({ ok: true }),
    notifyMerchantWhatsappOnNewPaidOrder(ctx),
  ]);
}

/**
 * Merchant alert when a customer payment clears. Tries providers in order:
 *   1. Telegram bot (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID) — free, instant, recommended
 *   2. CallMeBot WhatsApp (CALLMEBOT_PHONE + CALLMEBOT_APIKEY)
 *   3. Twilio WhatsApp (TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_WHATSAPP_FROM + MERCHANT_WHATSAPP_TO)
 *
 * Idempotent: only the first success path sets `merchantWhatsappNotifiedAt` on the order.
 */
async function notifyMerchantWhatsappOnNewPaidOrder(ctx: OrderNotificationContext): Promise<void> {
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;
  const callmeKey = process.env.CALLMEBOT_APIKEY;
  const callmePhone = process.env.CALLMEBOT_PHONE;
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;

  const hasAnyProvider =
    (telegramToken && telegramChatId) ||
    (callmeKey && callmePhone) ||
    (twilioSid && twilioToken);

  if (!hasAnyProvider) {
    logger.debug('[merchant-notify] skipped — set TELEGRAM_BOT_TOKEN+TELEGRAM_CHAT_ID or CALLMEBOT_* or TWILIO_*');
    return;
  }

  const text =
    `🛍️ New Zojo order!\n` +
    `Order: ${ctx.orderNumber}\n` +
    `Amount: ${inr(ctx.totalPaise)}\n` +
    `Customer: ${ctx.customerEmail}` +
    (ctx.customerPhone ? `\nPhone: ${ctx.customerPhone}` : '');

  const claimed = await prisma.order.updateMany({
    where: { id: ctx.orderId, merchantWhatsappNotifiedAt: null },
    data: { merchantWhatsappNotifiedAt: new Date() },
  });
  if (claimed.count === 0) return;

  const resetClaim = () =>
    prisma.order.update({ where: { id: ctx.orderId }, data: { merchantWhatsappNotifiedAt: null } });

  try {
    // ── 1. Telegram (preferred) ──────────────────────────────
    if (telegramToken && telegramChatId) {
      const res = await fetch(
        `https://api.telegram.org/bot${telegramToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: telegramChatId, text }),
        },
      );
      if (!res.ok) {
        const body = await res.text();
        logger.error({ status: res.status, body }, 'Telegram notify failed');
        await resetClaim();
        return;
      }
      logger.info({ orderId: ctx.orderId }, 'merchant notified via Telegram');
      return;
    }

    // ── 2. CallMeBot WhatsApp ────────────────────────────────
    if (callmeKey && callmePhone) {
      const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(
        callmePhone,
      )}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(callmeKey)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.text();
        logger.error({ status: res.status, body }, 'CallMeBot WhatsApp failed');
        await resetClaim();
        return;
      }
      logger.info({ orderId: ctx.orderId }, 'merchant notified via CallMeBot');
      return;
    }

    // ── 3. Twilio WhatsApp ───────────────────────────────────
    const from = process.env.TWILIO_WHATSAPP_FROM;
    const to = process.env.MERCHANT_WHATSAPP_TO;
    if (!from || !to) {
      logger.warn('[merchant-notify] Twilio creds set but TWILIO_WHATSAPP_FROM or MERCHANT_WHATSAPP_TO missing');
      await resetClaim();
      return;
    }
    const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
    const body = new URLSearchParams({
      To: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
      From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
      Body: text,
    });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      },
    );
    if (!res.ok) {
      const errBody = await res.text();
      logger.error({ status: res.status, errBody }, 'Twilio WhatsApp failed');
      await resetClaim();
      return;
    }
    logger.info({ orderId: ctx.orderId }, 'merchant notified via Twilio');
  } catch (err) {
    logger.error({ err, orderId: ctx.orderId }, 'merchant notify exception');
    await resetClaim();
  }
}

function buildEmailShell(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#1a1a1a;border-radius:12px;overflow:hidden">
        <!-- Header -->
        <tr><td style="background:#0f0f0f;padding:20px 28px;border-bottom:1px solid #2a2a2a">
          <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:4px">ZOJO</span>
          <span style="font-size:12px;color:#888;margin-left:8px">Fashion</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:28px">${bodyHtml}</td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 28px;border-top:1px solid #2a2a2a;text-align:center">
          <p style="margin:0;font-size:11px;color:#555">
            Questions? <a href="mailto:zojo.fashion.tee@gmail.com" style="color:#a855f7">zojo.fashion.tee@gmail.com</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function buildTimeline(activeStep: 'confirmed' | 'printing' | 'shipped' | 'delivered'): string {
  const steps = [
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'printing',  label: 'Printing'  },
    { key: 'shipped',   label: 'Shipped'   },
    { key: 'delivered', label: 'Delivered' },
  ];
  const activeIdx = steps.findIndex((s) => s.key === activeStep);
  const dots = steps
    .map((s, i) => {
      const done = i <= activeIdx;
      const dot = `<td align="center" style="width:25%">
        <div style="width:12px;height:12px;border-radius:50%;background:${done ? '#a855f7' : '#333'};margin:0 auto"></div>
        <div style="font-size:10px;color:${done ? '#d8b4fe' : '#555'};margin-top:4px;letter-spacing:0.5px">${s.label}</div>
      </td>`;
      return dot;
    })
    .join('<td style="padding-top:5px"><div style="height:2px;background:#2a2a2a;margin:0 4px"></div></td>');
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0">
    <tr>${dots}</tr>
  </table>`;
}

function buildItemsRows(items?: OrderNotificationContext['items']): string {
  if (!items || items.length === 0) return '';
  const rows = items
    .map(
      (it) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #2a2a2a">
          <div style="font-size:14px;color:#ffffff;font-weight:600">${escapeHtml(it.productTitle)}</div>
          <div style="font-size:12px;color:#888;margin-top:2px">${escapeHtml(it.variantLabel)} · Qty ${it.quantity}</div>
        </td>
      </tr>`,
    )
    .join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0">${rows}</table>`;
}

export async function notifyOrderShipped(ctx: OrderNotificationContext): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://zojo-fashion.yashharkawat.com';
  const trackUrl = `${siteUrl}/orders/${encodeURIComponent(ctx.orderNumber)}`;

  const body = `
    <h2 style="margin:0 0 4px;font-size:20px;color:#ffffff">Your package was shipped! 📦</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#aaa">Hi ${escapeHtml(ctx.customerName)}, your order is on its way.</p>

    ${buildTimeline('shipped')}

    <div style="background:#111;border-radius:8px;padding:14px 16px;margin-bottom:16px">
      <div style="font-size:11px;color:#666;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">Order</div>
      <div style="font-size:15px;color:#d8b4fe;font-weight:700;letter-spacing:1px">${escapeHtml(ctx.orderNumber)}</div>
      ${ctx.courier ? `<div style="font-size:12px;color:#888;margin-top:4px">Courier: ${escapeHtml(ctx.courier)}${ctx.awbNumber ? ` · AWB ${escapeHtml(ctx.awbNumber)}` : ''}</div>` : ''}
    </div>

    ${buildItemsRows(ctx.items)}

    <a href="${trackUrl}" style="display:block;text-align:center;background:#a855f7;color:#fff;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:1px;margin-top:8px">
      Track your order →
    </a>
    <p style="margin:16px 0 0;font-size:12px;color:#555;text-align:center">
      Estimated delivery: about one week from dispatch.
    </p>
  `;

  await Promise.allSettled([
    sendEmail({
      to: ctx.customerEmail,
      subject: `Your order ${ctx.orderNumber} has shipped!`,
      html: buildEmailShell(body),
      tags: { type: 'order_shipped', orderNumber: ctx.orderNumber },
    }),
    ctx.customerPhone
      ? sendSms({
          to: ctx.customerPhone,
          body: `Zojo Fashion: order ${ctx.orderNumber} shipped! Track: ${trackUrl}`,
        })
      : Promise.resolve({ ok: true }),
  ]);
}

export async function notifyOrderDelivered(ctx: OrderNotificationContext): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://zojo-fashion.yashharkawat.com';
  const ordersUrl = `${siteUrl}/orders`;

  const body = `
    <h2 style="margin:0 0 4px;font-size:20px;color:#ffffff">Delivered! 🎉</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#aaa">Hi ${escapeHtml(ctx.customerName)}, your order has arrived.</p>

    ${buildTimeline('delivered')}

    <div style="background:#111;border-radius:8px;padding:14px 16px;margin-bottom:16px">
      <div style="font-size:11px;color:#666;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">Order</div>
      <div style="font-size:15px;color:#d8b4fe;font-weight:700;letter-spacing:1px">${escapeHtml(ctx.orderNumber)}</div>
    </div>

    ${buildItemsRows(ctx.items)}

    <a href="${ordersUrl}" style="display:block;text-align:center;background:#a855f7;color:#fff;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:1px;margin-top:8px">
      View your orders →
    </a>
    <p style="margin:16px 0 0;font-size:12px;color:#555;text-align:center">
      Loved it? Leave a review on the product page — it helps other fans find us!
    </p>
  `;

  await sendEmail({
    to: ctx.customerEmail,
    subject: `Your order ${ctx.orderNumber} has been delivered! 🎉`,
    html: buildEmailShell(body),
    tags: { type: 'order_delivered', orderNumber: ctx.orderNumber },
  });
}

export async function notifyOrderCancelled(ctx: OrderNotificationContext, reason?: string): Promise<void> {
  await sendEmail({
    to: ctx.customerEmail,
    subject: `Order ${ctx.orderNumber} — issue with fulfillment`,
    html: `
      <p>Hi ${escapeHtml(ctx.customerName)},</p>
      <p>We ran into an issue fulfilling order <strong>${ctx.orderNumber}</strong>${reason ? `: ${escapeHtml(reason)}` : '.'} We're initiating a full refund — it should reflect in 5–7 business days.</p>
      <p>Reply to this email if you have questions.</p>
    `,
    tags: { type: 'order_cancelled', orderNumber: ctx.orderNumber },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
