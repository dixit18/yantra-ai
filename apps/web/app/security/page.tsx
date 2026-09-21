import type { Metadata } from 'next';
import { Button, Eyebrow, Shell } from '@yantra/ui';

export const metadata: Metadata = {
  title: 'Security & Governance — Yantra AI',
  description:
    'Risk classes, tenant isolation, audit trails, and approval-gated actions. What is enforced, and what is honestly not claimed yet.',
};

const NAV = [
  { href: '/product', label: 'Product' },
  { href: '/security', label: 'Security' },
  { href: '/contact', label: 'Contact' },
];

export default function Security() {
  return (
    <Shell nav={NAV} footerNote="Yantra AI — lean MVP demo. Synthetic unit, no customer data.">
      <section className="strip" aria-labelledby="security-h">
        <Eyebrow>Security &amp; governance</Eyebrow>
        <h1 id="security-h">Industrial support must fail safely.</h1>
        <p className="lede">
          Every answer carries its evidence threshold, every action carries an approval policy, and
          every tenant is isolated by construction — enforced in the database and the server, never
          by hiding buttons.
        </p>
      </section>

      <section className="strip" aria-labelledby="risk-h">
        <Eyebrow>Risk classes</Eyebrow>
        <h2 id="risk-h">Not every question earns the same answer.</h2>
        <div className="strip-grid">
          <div>
            <h3>R0–R1 · Informational</h3>
            <p>Product descriptions and approved maintenance information, with citations.</p>
          </div>
          <div>
            <h3>R2 · Controlled technical</h3>
            <p>Diagnostics that can affect operation face stricter evidence thresholds.</p>
          </div>
          <div>
            <h3>R3–R4 · Safety and prohibited control</h3>
            <p>
              Safety-critical instructions come only from approved procedures; autonomous machine
              control is out of scope without a separate certified architecture.
            </p>
          </div>
        </div>
      </section>

      <section className="strip" aria-labelledby="controls-h">
        <Eyebrow>Controls</Eyebrow>
        <h2 id="controls-h">Isolation, audit, and approval by default.</h2>
        <div className="strip-grid">
          <div>
            <h3>Tenant isolation</h3>
            <p>
              Knowledge, embeddings, files, and logs are tenant-scoped in PostgreSQL, with
              cross-tenant access denied and adversarially tested.
            </p>
          </div>
          <div>
            <h3>Immutable audit trail</h3>
            <p>
              Sources, approvals, evidence retrieved, tools called, and outcomes are append-only —
              the database itself rejects rewrites. Every claim on this page is exercised by the{' '}
              <a href="https://github.com/dixit18/yantra-ai">open test suite</a>.
            </p>
          </div>
          <div>
            <h3>Approval-gated actions</h3>
            <p>
              External writes carry idempotency keys, previews, and human approval persisted in
              PostgreSQL across restarts.
            </p>
          </div>
        </div>
      </section>

      <section className="strip" aria-labelledby="honest-h">
        <Eyebrow>Honestly stated</Eyebrow>
        <h2 id="honest-h">What we do not claim.</h2>
        <p className="lede">
          Certifications such as SOC 2 are pursued with the first enterprise deployment, not claimed
          in advance. Penetration tests, disaster-recovery drills, and load results will be
          published here when they exist — this page will not show badges earned by nobody.
        </p>
        <div className="cta-row">
          <Button href="/contact">Discuss a security review</Button>
          <Button variant="ghost" href="/product">
            Back to product
          </Button>
        </div>
      </section>
    </Shell>
  );
}
