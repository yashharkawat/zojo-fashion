import { z } from 'zod';
import { isValidIndiaMobileE164, toIndiaE164 } from '@/lib/phone';

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  // Union Territories
  'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
] as const;

export type IndianState = (typeof INDIAN_STATES)[number];

/** Single source of truth for address shape + validation rules. */
export const addressSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Enter your full name')
    .max(80, 'Too long'),
  phone: z
    .string()
    .trim()
    .min(1, 'Phone is required')
    .transform((s) => toIndiaE164(s))
    .refine((s) => isValidIndiaMobileE164(s), { message: 'Enter a valid 10-digit mobile (starts with 6–9)' }),
  email: z.string().trim().email('Enter a valid email'),
  line1: z.string().trim().min(4, 'Address line 1 is required').max(120),
  line2: z.string().trim().max(120).optional().or(z.literal('')),
  landmark: z.string().trim().max(80).optional().or(z.literal('')),
  city: z.string().trim().min(2, 'City is required').max(60),
  state: z.enum(INDIAN_STATES, { message: 'Select your state' }),
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9]\d{5}$/, 'Pincode must be 6 digits'),
  saveForLater: z.boolean().default(true),
});

export type AddressInput = z.infer<typeof addressSchema>;

/** Normalize a raw form state object to trimmed/safe values. */
export function normalizeAddress(raw: Partial<AddressInput>): Partial<AddressInput> {
  return {
    ...raw,
    fullName: raw.fullName?.trim(),
    phone: raw.phone?.trim(),
    email: raw.email?.trim().toLowerCase(),
    line1: raw.line1?.trim(),
    line2: raw.line2?.trim() || undefined,
    landmark: raw.landmark?.trim() || undefined,
    city: raw.city?.trim(),
    pincode: raw.pincode?.trim(),
  };
}
