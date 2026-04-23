/**
 * India mobile → E.164. Users can type 10 digits, 0 + 10, 12-digit 91…, or +91….
 */
export function toIndiaE164(input: string): string {
  const t = input.trim().replace(/\s/g, '');
  if (/^\+91[6-9]\d{9}$/.test(t)) return t;
  const d = input.replace(/\D/g, '');
  if (d.length === 10 && /^[6-9]\d{9}$/.test(d)) return `+91${d}`;
  if (d.length === 12 && d.startsWith('91') && /^[6-9]/.test(d[2]!)) return `+${d}`;
  if (d.length === 11 && d[0] === '0' && /^[6-9]/.test(d[1]!)) return `+91${d.slice(1)}`;
  return t;
}

export function isValidIndiaMobileE164(s: string): boolean {
  return /^\+91[6-9]\d{9}$/.test(s);
}

/** E.164 +91… → 10 digits for form inputs. */
export function e164ToLocal10(phone: string): string {
  if (/^\+91[6-9]\d{9}$/.test(phone)) return phone.slice(3);
  const d = phone.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) return d.slice(2);
  if (d.length === 10) return d;
  return d.slice(-10);
}
