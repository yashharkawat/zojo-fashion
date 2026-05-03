import type { Metadata } from 'next';
import { StaticInfoPage } from '@/components/layout/StaticInfoPage';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description: 'Terms and conditions for shopping at ZOJO Fashion.',
};

export default function TermsPage() {
  return (
    <StaticInfoPage title="Terms & Conditions">
      <p className="text-fg-muted">Last updated: May 2026</p>

      <h2 className="font-display text-lg text-fg-primary">1. Acceptance of Terms</h2>
      <p>
        By accessing or placing an order on zojo-fashion.yashharkawat.com ("the Site"), you agree
        to be bound by these Terms & Conditions. If you do not agree, please do not use the Site.
      </p>

      <h2 className="font-display text-lg text-fg-primary">2. Products & Pricing</h2>
      <p>
        All prices are listed in Indian Rupees (₹) and are inclusive of applicable taxes. A flat
        ₹50 delivery fee applies to all orders. We reserve the right to change prices at any time
        without prior notice. Price changes will not affect orders already confirmed.
      </p>
      <p>
        Product images are representative. Slight colour variations may occur due to screen
        calibration and the nature of DTG/DTF printing.
      </p>

      <h2 className="font-display text-lg text-fg-primary">3. Orders & Payment</h2>
      <p>
        All orders are prepaid. We accept payments via UPI, cards, net banking, and wallets through
        Razorpay. An order is confirmed only after successful payment authorisation. We reserve the
        right to cancel any order due to stock unavailability or suspected fraud, with a full refund
        issued.
      </p>

      <h2 className="font-display text-lg text-fg-primary">4. Shipping</h2>
      <p>
        We ship across India. Orders are typically processed and dispatched within 5–6 business
        days. Delivery timelines depend on your location and the assigned courier. We are not
        responsible for delays caused by couriers or unforeseen circumstances.
      </p>

      <h2 className="font-display text-lg text-fg-primary">5. Returns & Refunds</h2>
      <p>
        Returns are accepted only for verified manufacturing defects or damage on arrival. Please
        refer to our{' '}
        <a href="/refund-policy">Refund Policy</a> for full details.
      </p>

      <h2 className="font-display text-lg text-fg-primary">6. Intellectual Property</h2>
      <p>
        All designs, artwork, logos, and content on this Site are the intellectual property of ZOJO
        Fashion. Reproducing, distributing, or selling any content or design without prior written
        consent is strictly prohibited.
      </p>

      <h2 className="font-display text-lg text-fg-primary">7. Limitation of Liability</h2>
      <p>
        ZOJO Fashion shall not be liable for any indirect, incidental, or consequential damages
        arising from the use of this Site or products purchased. Our liability is limited to the
        value of the order placed.
      </p>

      <h2 className="font-display text-lg text-fg-primary">8. Governing Law</h2>
      <p>
        These terms are governed by the laws of India. Any disputes shall be subject to the
        exclusive jurisdiction of courts in India.
      </p>

      <h2 className="font-display text-lg text-fg-primary">9. Contact</h2>
      <p>
        For any questions about these terms, email us at{' '}
        <a href="mailto:zojo.fashion.tee@gmail.com">zojo.fashion.tee@gmail.com</a>.
      </p>
    </StaticInfoPage>
  );
}
