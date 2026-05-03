import type { Metadata } from 'next';
import { StaticInfoPage } from '@/components/layout/StaticInfoPage';

export const metadata: Metadata = {
  title: 'Refund Policy',
  description: 'ZOJO refund and returns policy — defective items, timelines, and how to raise a claim.',
};

export default function RefundPolicyPage() {
  return (
    <StaticInfoPage title="Refund Policy">
      <p className="text-fg-muted">Last updated: May 2026</p>

      <h2 className="font-display text-lg text-fg-primary">Our Policy</h2>
      <p>
        Because every ZOJO product is custom-printed on demand, we do not accept returns or
        exchanges for reasons of size, fit, colour preference, or change of mind. Please review
        the <a href="/size-guide">size guide</a> carefully before ordering.
      </p>
      <p>
        We do, however, fully stand behind the quality of our printing and the physical condition
        of items on arrival.
      </p>

      <h2 className="font-display text-lg text-fg-primary">When You Are Eligible for a Replacement</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>The item has a verified printing defect (faded print, misaligned artwork, incorrect design)</li>
        <li>The item arrived physically damaged (torn, soiled, or structurally defective)</li>
        <li>You received the wrong item or size</li>
      </ul>

      <h2 className="font-display text-lg text-fg-primary">Time Window</h2>
      <p>
        Claims must be raised within <strong className="text-fg-primary">48 hours of delivery</strong>.
        Claims raised after this window will not be accepted. Check your order as soon as it arrives.
      </p>

      <h2 className="font-display text-lg text-fg-primary">How to Raise a Claim</h2>
      <ol className="list-decimal space-y-1 pl-5">
        <li>Email <a href="mailto:zojo.fashion.tee@gmail.com">zojo.fashion.tee@gmail.com</a> within 48 hours of delivery</li>
        <li>Include your order number in the subject line</li>
        <li>Attach clear photos showing the defect or damage</li>
        <li>We will review and respond within 2 business days</li>
      </ol>
      <p>
        If your claim is approved, we will arrange a replacement at no additional cost. We do not
        offer cash refunds — only replacements for verified defect cases.
      </p>

      <h2 className="font-display text-lg text-fg-primary">Cancelled Orders</h2>
      <p>
        Orders cannot be cancelled once they have been confirmed and payment has been processed, as
        production begins immediately. If you believe your order was charged in error, contact us
        as soon as possible.
      </p>

      <h2 className="font-display text-lg text-fg-primary">Questions</h2>
      <p>
        For anything not covered here, email{' '}
        <a href="mailto:zojo.fashion.tee@gmail.com">zojo.fashion.tee@gmail.com</a>.
      </p>
    </StaticInfoPage>
  );
}
