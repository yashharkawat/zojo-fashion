'use client';

import { PageTransition } from '@/components/motion/PageTransition';

export default function ProfilePage() {
  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 font-display text-3xl tracking-tight text-fg-primary">Profile</h1>
        <p className="text-fg-secondary">
          Personal info, addresses, password — wire with <code>/auth/me</code> and <code>/addresses</code>.
        </p>
      </div>
    </PageTransition>
  );
}
