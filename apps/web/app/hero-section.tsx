'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import {
  HERO_STEPS,
  MachinePoster,
  SUBSYSTEM_INFO,
  prefersReducedMotion,
  stepById,
  webglAvailable,
  type StoryStepId,
  type Subsystem,
} from '@yantra/3d';

export const DEMO_SERIAL = 'SN YAN-PH-2041 · REV C';

const HeroCanvas = dynamic(() => import('./hero-canvas').then((m) => m.HeroCanvas), {
  ssr: false,
  loading: () => <MachinePoster serial={DEMO_SERIAL} />,
});

export function HeroSection() {
  const [stepId, setStepId] = useState<StoryStepId>('scan');
  const [selected, setSelected] = useState<Subsystem | null>(null);
  const [canvas, setCanvas] = useState(false);

  // Poster first (SSR-safe, zero JS cost); upgrade only when motion is full
  // AND WebGL exists. A live media-query listener downgrades mid-session if
  // the OS switches to reduced motion. Primary copy and CTAs never wait.
  useEffect(() => {
    const update = () => {
      setCanvas(!prefersReducedMotion() && webglAvailable());
    };
    update();
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener('change', update);
    return () => {
      mq.removeEventListener('change', update);
    };
  }, []);

  const step = stepById(stepId);
  const info = selected ? SUBSYSTEM_INFO[selected] : null;

  return (
    <section id="demo" className="hero" aria-labelledby="hero-h">
      <div className="hero-copy">
        <p className="eyebrow">Yantra AI — governed product specialist</p>
        <h1 id="hero-h">Your best service engineer, available on every machine.</h1>
        <p className="lede">
          Turn manuals, parts data, service history and expert rules into a governed product
          specialist for customers, dealers and technicians.
        </p>
        <div className="cta-row">
          <a className="btn btn-primary" href="#demo-visual">
            See how a machine is resolved
          </a>
          <a className="btn btn-ghost" href="#problem">
            Why it matters
          </a>
        </div>
        <div className="stepper" role="group" aria-label="Machine journey">
          {HERO_STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === stepId}
              className="step-btn"
              onClick={() => setStepId(s.id)}
            >
              <span className="mono">{s.eyebrow}</span>
            </button>
          ))}
        </div>
        <p className="annotation" data-testid="step-annotation">
          <strong>{step.title}</strong> {step.body}
        </p>
        {info ? (
          <p className="node-info" data-testid="node-info">
            <strong className="mono">{info.label}</strong> — {info.blurb}
          </p>
        ) : null}
      </div>
      <div className="hero-visual" id="demo-visual">
        {canvas ? (
          <HeroCanvas step={step} selected={selected} onSelect={setSelected} />
        ) : (
          <MachinePoster serial={DEMO_SERIAL} />
        )}
        <p className="mono visual-caption">Interactive demo — synthetic unit</p>
      </div>
    </section>
  );
}
