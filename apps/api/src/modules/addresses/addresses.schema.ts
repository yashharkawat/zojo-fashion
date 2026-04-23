import { z } from 'zod';
import { toIndiaE164 } from '../../lib/phone';
import { INDIAN_STATES } from './indianStates';

export const createAddressBodySchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .min(1)
    .refine(
      (s) => {
        try {
          toIndiaE164(s);
          return true;
        } catch {
          return false;
        }
      },
      { message: 'Enter 10 digits (Indian mobile, starts with 6–9)' },
    )
    .transform((s) => toIndiaE164(s)),
  line1: z.string().trim().min(4).max(120),
  line2: z.string().trim().max(120).optional().or(z.literal('')).transform((x) => x || undefined),
  landmark: z.string().trim().max(80).optional().or(z.literal('')).transform((x) => x || undefined),
  city: z.string().trim().min(2).max(60),
  state: z
    .string()
    .refine((s) => (INDIAN_STATES as readonly string[]).includes(s), 'Invalid state'),
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9]\d{5}$/),
  saveForLater: z.boolean().optional().default(true),
});

export type CreateAddressBody = z.infer<typeof createAddressBodySchema>;
