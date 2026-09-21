import type { Metadata } from 'next';
import { Button, Chip, Eyebrow, Shell } from '@yantra/ui';

export const metadata: Metadata = {
  title: 'Product — Yantra AI',
  description:
    'Service knowledge and spare-parts identification for pharma and packaging machinery, grounded in manufacturer-approved sources.',
};

const NAV = [
  { href: '/product', label: 'Product' },
  { href: '/security', label: 'Security' },
  { href: '/contact', label: 'Contact' },
];

export default function Product() {
  return (
    <Shell nav={NAV} footerNote="Yantra AI — lean MVP demo. Synthetic unit, no customer data.">
      <section className="strip" aria-labelledby="product-h">
        <Eyebrow>Product</Eyebrow>
        <h1 id="product-h">Service knowledge and parts identification that cites its sources.</h1>
        <p className="lede">
          The starting wedge is narrow on purpose: pharma and packaging machinery service knowledge
          plus spare-parts identification. A technician selects a known machine, asks a support
          question, and gets a grounded answer with exact citations — or a complete escalation
          packet when the evidence is not enough.
        </p>
        <div className="cta-row">
          <Button href="/#demo">Try the interactive demo</Button>
          <Button variant="ghost" href="/security">
            How answers stay safe
          </Button>
        </div>
      </section>

      <section className="strip" aria-labelledby="journey-h">
        <Eyebrow>How it works</Eyebrow>
        <h2 id="journey-h">Scan, identify, diagnose, act.</h2>
        <div className="strip-grid">
          <div>
            <h3>1. Scan</h3>
            <p>A QR deep link resolves tenant, site, serial, revision, and installed options.</p>
          </div>
          <div>
            <h3>2. Identify</h3>
            <p>Model and revision scope every answer to the unit in front of the technician.</p>
          </div>
          <div>
            <h3>3. Diagnose</h3>
            <p>Fault codes map to approved procedures, each step cited — or the case escalates.</p>
          </div>
        </div>
        <div className="strip-grid">
          <div>
            <h3>4. Act</h3>
            <p>Compatible parts, service cases, and RFQ drafts carry the full context forward.</p>
          </div>
          <div>
            <h3>WhatsApp &amp; voice</h3>
            <p>
              Same policy core on the channels technicians already use. <Chip>Roadmap</Chip>
            </p>
          </div>
          <div>
            <h3>IoT &amp; proactive care</h3>
            <p>
              Telemetry and lifecycle intelligence arrive after product-market fit.{' '}
              <Chip>Roadmap</Chip>
            </p>
          </div>
        </div>
      </section>

      <section className="strip" aria-labelledby="not-h">
        <Eyebrow>Boundaries</Eyebrow>
        <h2 id="not-h">What Yantra AI is not.</h2>
        <div className="strip-grid">
          <div>
            <h3>Not a PDF chatbot</h3>
            <p>Answers come from approved sources, rules, and calculators — with citations.</p>
          </div>
          <div>
            <h3>Not an ERP replacement</h3>
            <p>Your ERP, CRM, and field-service tools stay the systems of record.</p>
          </div>
          <div>
            <h3>Not a machine controller</h3>
            <p>It never commands machinery or invents safety, electrical, or torque values.</p>
          </div>
        </div>
      </section>
    </Shell>
  );
}
