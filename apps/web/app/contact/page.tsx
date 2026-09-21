import type { Metadata } from 'next';
import { Eyebrow, Shell } from '@yantra/ui';
import { PilotForm } from './form';

export const metadata: Metadata = {
  title: 'Contact — Yantra AI',
  description: 'Request a Yantra AI pilot for your machinery service team.',
};

const NAV = [
  { href: '/product', label: 'Product' },
  { href: '/security', label: 'Security' },
  { href: '/contact', label: 'Contact' },
];

export default function Contact() {
  return (
    <Shell nav={NAV} footerNote="Yantra AI — lean MVP demo. Synthetic unit, no customer data.">
      <section className="strip" aria-labelledby="contact-h">
        <Eyebrow>Contact</Eyebrow>
        <h1 id="contact-h">Request a pilot.</h1>
        <p className="lede">
          One product family, one service team, one controlled cohort. Tell us about your service
          challenge — this demo validates your input locally and sends nothing.
        </p>
        <noscript>
          <p>
            Validation needs JavaScript; without it this form cannot check your input. Pilot intake
            opens with the first design partner.
          </p>
        </noscript>
        <PilotForm />
      </section>
    </Shell>
  );
}
