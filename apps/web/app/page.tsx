import { Button, Chip, Eyebrow, Shell } from '@yantra/ui';
import { HeroSection } from './hero-section';

const NAV = [
  { href: '/product', label: 'Product' },
  { href: '/security', label: 'Security' },
  { href: '/contact', label: 'Contact' },
];

export default function Home() {
  return (
    <Shell nav={NAV} footerNote="Yantra AI — lean MVP demo. Synthetic unit, no customer data.">
      <HeroSection />

      <section id="problem" className="strip" aria-labelledby="problem-h">
        <Eyebrow>The problem</Eyebrow>
        <h2 id="problem-h">
          The answer usually exists. Finding the right one is the expensive part.
        </h2>
        <div className="strip-grid">
          <div>
            <h3>Trapped knowledge</h3>
            <p>Manuals know one piece. ERP knows another. Service history lives somewhere else.</p>
          </div>
          <div>
            <h3>Senior-engineer bottleneck</h3>
            <p>
              The final answer often waits on one experienced engineer — on phone, WhatsApp, or
              mail.
            </p>
          </div>
          <div>
            <h3>Wrong-part leakage</h3>
            <p>Slow, revision-blind part identification leaks spares revenue and trust.</p>
          </div>
        </div>
      </section>

      <section id="governance" className="strip" aria-labelledby="governance-h">
        <Eyebrow>Governance</Eyebrow>
        <h2 id="governance-h">Answers you can inspect. Actions you can control.</h2>
        <div className="strip-grid">
          <div>
            <h3>Cited evidence</h3>
            <p>
              Technical answers name the document, version, and page they came from — or the system
              abstains instead of guessing.
            </p>
          </div>
          <div>
            <h3>Deterministic rules</h3>
            <p>
              Compatibility, calculations, and limits run through explicit product rules, never
              model improvisation.
            </p>
          </div>
          <div>
            <h3>Safe escalation</h3>
            <p>
              Uncertain cases become context packets — machine, evidence, steps tried — for the
              right expert, never a dead end.
            </p>
          </div>
        </div>
      </section>

      <section id="lanes" className="strip" aria-labelledby="lanes-h">
        <Eyebrow>Three outcome lanes</Eyebrow>
        <h2 id="lanes-h">Support should not end with an answer.</h2>
        <div className="strip-grid">
          <div>
            <h3>Service &amp; support</h3>
            <p>
              Fault codes, approved diagnostic steps, and case creation with full machine context
              attached.
            </p>
          </div>
          <div>
            <h3>Parts &amp; aftermarket</h3>
            <p>Serial-aware fitment, supersession handling, and quote-ready parts requests.</p>
          </div>
          <div>
            <h3>Sales &amp; configuration</h3>
            <p>
              Requirement interviews against approved selectors, with assumptions stated and RFQ
              drafts to prove it. <Chip>Roadmap</Chip>
            </p>
          </div>
        </div>
      </section>

      <section id="knowledge" className="strip" aria-labelledby="knowledge-h">
        <Eyebrow>Knowledge engine</Eyebrow>
        <h2 id="knowledge-h">Manuals, tickets, and experts — versioned as one source.</h2>
        <p className="lede">
          Document versions are immutable, assertions need expert approval, and conflicts surface
          for review instead of resolving silently. Resolved cases become reviewable candidates —
          never auto-promoted truth.
        </p>
      </section>

      <section id="pilot" className="strip" aria-labelledby="pilot-h">
        <Eyebrow>Pilot</Eyebrow>
        <h2 id="pilot-h">Start with one product family, one service team.</h2>
        <p className="lede">
          One OEM, 3–10 representative models, one controlled cohort. Measured before/after — never
          manufactured ROI.
        </p>
        <div className="cta-row">
          <Button href="/contact">Request a pilot</Button>
          <Button variant="ghost" href="/product">
            How it works
          </Button>
        </div>
      </section>
    </Shell>
  );
}
