import { api } from '@/lib/api';
import type { AddressInput } from '@/types/address';

export interface CreatedAddress {
  id: string;
  fullName: string;
  phone: string;
  isDefault: boolean;
  createdAt: string;
}

export interface SavedAddressRow {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
  createdAt: string;
}

export function listAddresses() {
  return api<SavedAddressRow[]>('/addresses', { method: 'GET' });
}

/**
 * Create a saved address for the logged-in user.
 * The returned `id` is used as `shippingAddressId` on `POST /orders`.
 */
export function createAddress(body: AddressInput) {
  return api<CreatedAddress>('/addresses', {
    method: 'POST',
    body: {
      fullName: body.fullName,
      phone: body.phone,
      line1: body.line1,
      line2: body.line2,
      landmark: body.landmark,
      city: body.city,
      state: body.state,
      pincode: body.pincode,
      saveForLater: body.saveForLater,
    },
  });
}
