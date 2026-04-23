'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { PageTransition } from '@/components/motion/PageTransition';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { Skeleton } from '@/components/ui/Skeleton';
import { authApi } from '@/features/auth/api';
import { listAddresses, type SavedAddressRow } from '@/features/addresses/api';
import { ApiClientError } from '@/types/api';

function AddressCard({ a }: { a: SavedAddressRow }) {
  return (
    <li className="rounded-xl border border-bg-border bg-bg-elevated p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-fg-primary">{a.fullName}</p>
          <p className="text-sm text-fg-secondary">{a.phone}</p>
        </div>
        {a.isDefault && (
          <span className="shrink-0 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
            Default
          </span>
        )}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-fg-secondary">
        {a.line1}
        {a.line2 ? <>, {a.line2}</> : null}
        {a.landmark ? <>, {a.landmark}</> : null}
        <br />
        {a.city}, {a.state} {a.pincode}
      </p>
    </li>
  );
}

function ProfileContent() {
  const me = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authApi.me(),
  });
  const addresses = useQuery({
    queryKey: ['addresses'],
    queryFn: () => listAddresses(),
  });

  const meErr = me.isError
    ? me.error instanceof ApiClientError
      ? me.error.message
      : 'Could not load profile'
    : null;
  const addrErr = addresses.isError
    ? addresses.error instanceof ApiClientError
      ? addresses.error.message
      : 'Could not load addresses'
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-10 px-4 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight text-fg-primary">Profile</h1>
        <p className="mt-2 text-sm text-fg-secondary">Your account and saved shipping addresses.</p>
      </header>

      <section>
        <h2 className="mb-3 font-display text-lg tracking-wide text-fg-primary">Account</h2>
        {me.isLoading && <Skeleton className="h-28 w-full rounded-xl" />}
        {meErr && (
          <p className="text-sm text-danger" role="alert">
            {meErr}
          </p>
        )}
        {me.data && (
          <div className="rounded-xl border border-bg-border bg-bg-elevated p-5 text-sm">
            <dl className="space-y-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-fg-muted">Name</dt>
                <dd className="text-fg-primary">
                  {[me.data.firstName, me.data.lastName].filter(Boolean).join(' ') || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-fg-muted">Email</dt>
                <dd className="text-fg-primary">{me.data.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-fg-muted">Phone</dt>
                <dd className="text-fg-primary">{me.data.phone ?? '—'}</dd>
              </div>
            </dl>
            <p className="mt-4 border-t border-bg-border pt-4 text-xs text-fg-muted">
              To change your password, use{' '}
              <Link href="/password-reset" className="text-accent hover:underline">
                email reset
              </Link>{' '}
              with the address above.
            </p>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-display text-lg tracking-wide text-fg-primary">Addresses</h2>
          <Link
            href="/checkout"
            className="text-sm font-semibold text-accent hover:underline"
          >
            Use checkout to add
          </Link>
        </div>
        {addresses.isLoading && <Skeleton className="h-32 w-full rounded-xl" />}
        {addrErr && (
          <p className="text-sm text-danger" role="alert">
            {addrErr}
          </p>
        )}
        {addresses.data && addresses.data.length === 0 && (
          <p className="rounded-xl border border-bg-border border-dashed bg-bg-elevated/50 px-4 py-6 text-sm text-fg-secondary">
            No saved addresses yet. Add one during{' '}
            <Link href="/checkout" className="text-accent hover:underline">
              checkout
            </Link>
            .
          </p>
        )}
        {addresses.data && addresses.data.length > 0 && (
          <ul className="space-y-3">
            {addresses.data.map((a) => (
              <AddressCard key={a.id} a={a} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <PageTransition>
      <RequireAuth>
        <ProfileContent />
      </RequireAuth>
    </PageTransition>
  );
}
