import type { Request, Response } from 'express';
import { ValidationError } from '../../lib/errors';
import { handlePrintroveWebhook } from './printrove.webhook.service';

export async function webhookHandler(req: Request, res: Response) {
  const signature = req.header('x-printrove-signature');
  if (!signature) throw new ValidationError('Missing x-printrove-signature');
  const eventId = req.header('x-printrove-event-id') ?? undefined;

  const rawBody = Buffer.isBuffer(req.body)
    ? req.body.toString('utf-8')
    : typeof req.body === 'string'
    ? req.body
    : JSON.stringify(req.body);

  const result = await handlePrintroveWebhook({ rawBody, signature, eventId });
  return res.status(200).json({ ok: true, applied: result.applied, reason: result.reason ?? null });
}
