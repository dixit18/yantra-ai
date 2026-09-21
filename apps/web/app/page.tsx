import { Eyebrow, Shell } from '@yantra/ui';
import { HeroSection } from './hero-section';

export default function Home() {
  return (
    <Shell
      nav={[
        { href: '#demo', label: 'Demo' },
        { href: '#problem', label: 'Problem' },
      ]}
      footerNote="Yantra AI — lean MVP demo. Synthetic unit, no customer data."
    >
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
    </Shell>
  );
}
