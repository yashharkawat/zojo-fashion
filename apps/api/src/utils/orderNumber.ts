import crypto from 'node:crypto';

/**
 * Generates a human-friendly order number: ZJ-YYYY-XXXXXX
 * (6 random base36 digits). Collisions checked at DB level via unique constraint.
 */
export function generateOrderNumber(): string {
  const year = new Date().getUTCFullYear();
  const suffix = crypto.randomBytes(4).readUInt32BE(0).toString(36).toUpperCase().slice(0, 6).padStart(6, '0');
  return `ZJ-${year}-${suffix}`;
}
