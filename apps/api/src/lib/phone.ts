import { ValidationError } from './errors';

/**
 * Normalise user input to Indian mobile E.164 (+91 + 10 digits).
 * Accepts: 10 digits, 0 + 10 digits, 12-digit 91XXXXXXXXXX, or +91XXXXXXXXXX.
 */
export function toIndiaE164(input: string): string {
  const t = input.trim().replace(/\s/g, '');
  if (/^\+91[6-9]\d{9}$/.test(t)) return t;
  const d = input.replace(/\D/g, '');
  if (d.length === 10 && /^[6-9]\d{9}$/.test(d)) return `+91${d}`;
  if (d.length === 12 && d.startsWith('91') && /^[6-9]/.test(d[2]!)) return `+${d}`;
  if (d.length === 11 && d[0] === '0' && /^[6-9]/.test(d[1]!)) return `+91${d.slice(1)}`;
  throw new ValidationError('Invalid Indian mobile number. Enter 10 digits (starting with 6–9).');
}
