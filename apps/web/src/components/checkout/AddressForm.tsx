'use client';

import { useState, type FormEvent } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  addressSchema,
  normalizeAddress,
  INDIAN_STATES,
  type AddressInput,
} from '@/types/address';

export interface AddressFormProps {
  defaultValues?: Partial<AddressInput>;
  onSubmit: (values: AddressInput) => void | Promise<void>;
  submitLabel?: string;
}

type Errors = Partial<Record<keyof AddressInput, string>>;

export function AddressForm({
  defaultValues,
  onSubmit,
  submitLabel = 'Continue to Review',
}: AddressFormProps) {
  const [values, setValues] = useState<Partial<AddressInput>>({
    saveForLater: true,
    ...defaultValues,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  const setField = <K extends keyof AddressInput>(key: K, v: AddressInput[K]) => {
    setValues((prev) => ({ ...prev, [key]: v }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = addressSchema.safeParse(normalizeAddress(values));
      if (!result.success) {
        const flat: Errors = {};
        for (const issue of result.error.issues) {
          const key = issue.path[0] as keyof AddressInput | undefined;
          if (key) flat[key] = issue.message;
        }
        setErrors(flat);
        const firstErr = Object.keys(flat)[0];
        if (firstErr) {
          const el = document.querySelector<HTMLElement>(`[name="${firstErr}"]`);
          el?.focus();
        }
        return;
      }
      await Promise.resolve(onSubmit(result.data));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <Input
        name="fullName"
        label="Full name"
        placeholder="Rahul Sharma"
        autoComplete="name"
        value={values.fullName ?? ''}
        onChange={(e) => setField('fullName', e.target.value)}
        error={errors.fullName}
        required
      />

      <div className="grid gap-5 md:grid-cols-2">
        <Input
          name="phone"
          label="Phone"
          type="tel"
          autoComplete="tel"
          inputMode="numeric"
          placeholder="9876543210"
          value={values.phone ?? ''}
          onChange={(e) => setField('phone', e.target.value)}
          hint="10-digit Indian mobile. +91 is added automatically."
          error={errors.phone}
          required
        />
        <Input
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@email.com"
          value={values.email ?? ''}
          onChange={(e) => setField('email', e.target.value)}
          error={errors.email}
          required
        />
      </div>

      <Input
        name="line1"
        label="Address line 1"
        placeholder="House, building, street"
        autoComplete="address-line1"
        value={values.line1 ?? ''}
        onChange={(e) => setField('line1', e.target.value)}
        error={errors.line1}
        required
      />
      <Input
        name="line2"
        label="Address line 2 (optional)"
        placeholder="Apartment, suite, etc."
        autoComplete="address-line2"
        value={values.line2 ?? ''}
        onChange={(e) => setField('line2', e.target.value)}
        error={errors.line2}
      />
      <Input
        name="landmark"
        label="Landmark (optional)"
        placeholder="Near metro, mall…"
        value={values.landmark ?? ''}
        onChange={(e) => setField('landmark', e.target.value)}
        error={errors.landmark}
      />

      <div className="grid gap-5 md:grid-cols-3">
        <Input
          name="city"
          label="City"
          autoComplete="address-level2"
          value={values.city ?? ''}
          onChange={(e) => setField('city', e.target.value)}
          error={errors.city}
          required
        />
        <Select
          name="state"
          label="State"
          autoComplete="address-level1"
          value={values.state ?? ''}
          onChange={(e) => setField('state', e.target.value as AddressInput['state'])}
          error={errors.state}
          required
        >
          <option value="">Select state</option>
          {INDIAN_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Input
          name="pincode"
          label="Pincode"
          inputMode="numeric"
          maxLength={6}
          autoComplete="postal-code"
          value={values.pincode ?? ''}
          onChange={(e) => setField('pincode', e.target.value.replace(/\D/g, ''))}
          error={errors.pincode}
          required
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-fg-secondary">
        <input
          type="checkbox"
          checked={values.saveForLater ?? true}
          onChange={(e) => setField('saveForLater', e.target.checked)}
          className="h-4 w-4 rounded border-bg-border bg-bg-elevated text-accent focus:ring-accent"
        />
        Save this address for future orders
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="flex h-12 w-full items-center justify-center rounded-lg bg-accent font-semibold uppercase tracking-widest text-white shadow-glow-sm transition-all hover:bg-accent-hover hover:shadow-glow disabled:opacity-60"
      >
        {submitting ? 'Validating…' : submitLabel}
      </button>
    </form>
  );
}

/** Re-export the type so parents can `import { AddressInput }` from this module. */
export type { AddressInput } from '@/types/address';
