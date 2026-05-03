import type { Metadata } from 'next';
import { StaticInfoPage } from '@/components/layout/StaticInfoPage';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How ZOJO collects, uses, and protects your personal information.',
};

export default function PrivacyPolicyPage() {
  return (
    <StaticInfoPage title="Privacy Policy">
      <p className="text-fg-muted">Last updated: May 2026</p>

      <h2 className="font-display text-lg text-fg-primary">1. Information We Collect</h2>
      <p>
        When you place an order or create an account, we collect your name, email address, phone
        number, and delivery address. Payment transactions are processed by Razorpay — we do not
        store your card details on our servers.
      </p>
      <p>
        We also collect non-personal usage data (pages visited, time spent, device type) through
        Google Analytics 4 to understand how visitors use the site and improve it.
      </p>

      <h2 className="font-display text-lg text-fg-primary">2. How We Use Your Information</h2>
      <p>We use your information to:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Process and fulfil your orders</li>
        <li>Send order confirmation, shipping updates, and support responses</li>
        <li>Improve the website and product offerings using anonymised analytics</li>
        <li>Comply with legal obligations under Indian law</li>
      </ul>
      <p>We do not sell, rent, or share your personal data with third parties for marketing.</p>

      <h2 className="font-display text-lg text-fg-primary">3. Cookies</h2>
      <p>
        We use essential cookies to keep you logged in and maintain your cart. Google Analytics
        sets additional cookies to measure site usage. You can disable cookies in your browser
        settings, but some features (cart, login) may stop working.
      </p>

      <h2 className="font-display text-lg text-fg-primary">4. Data Storage & Security</h2>
      <p>
        Your data is stored on secured servers. We use HTTPS across the entire site. Access to
        personal data is restricted to authorised team members only.
      </p>

      <h2 className="font-display text-lg text-fg-primary">5. Your Rights</h2>
      <p>
        You may request access to, correction of, or deletion of your personal data at any time by
        emailing{' '}
        <a href="mailto:zojo.fashion.tee@gmail.com">zojo.fashion.tee@gmail.com</a>. We will respond
        within 30 days.
      </p>

      <h2 className="font-display text-lg text-fg-primary">6. Governing Law</h2>
      <p>
        This policy is governed by the Information Technology Act, 2000 and the IT (Amendment) Act,
        2008 of India. Any disputes shall be subject to the jurisdiction of courts in India.
      </p>

      <h2 className="font-display text-lg text-fg-primary">7. Contact</h2>
      <p>
        For privacy-related queries, contact us at{' '}
        <a href="mailto:zojo.fashion.tee@gmail.com">zojo.fashion.tee@gmail.com</a>.
      </p>
    </StaticInfoPage>
  );
}
