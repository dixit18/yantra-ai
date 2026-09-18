import { describe, expect, it } from 'vitest';
import {
  HERO_STEPS,
  STORY_STEPS,
  SUBSYSTEMS,
  SUBSYSTEM_INFO,
  nextStep,
  prevStep,
  statusLightIntensity,
  stepById,
} from './story.js';

describe('hero story machine', () => {
  it('defines one step per journey stage in order', () => {
    expect(HERO_STEPS.map((s) => s.id)).toEqual([...STORY_STEPS]);
  });

  it('gives every step a camera, copy, and light state', () => {
    for (const step of HERO_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body.length).toBeGreaterThan(0);
      expect(step.camera.position).toHaveLength(3);
      expect(step.camera.target).toHaveLength(3);
    }
  });

  it('cycles forward and back with wraparound', () => {
    expect(nextStep('scan')).toBe('identify');
    expect(nextStep('act')).toBe('scan');
    expect(prevStep('scan')).toBe('act');
    expect(prevStep('diagnose')).toBe('identify');
  });

  it('rejects unknown step ids', () => {
    expect(() => stepById('ship' as never)).toThrow(/unknown story step/);
  });

  it('documents every selectable subsystem', () => {
    expect(Object.keys(SUBSYSTEM_INFO).sort()).toEqual([...SUBSYSTEMS].sort());
    for (const id of SUBSYSTEMS) {
      expect(SUBSYSTEM_INFO[id].label.length).toBeGreaterThan(0);
      expect(SUBSYSTEM_INFO[id].blurb.length).toBeGreaterThan(0);
    }
  });

  it('ranks selection above focus above rest for status lights', () => {
    expect(statusLightIntensity(2.4, false, false)).toBe(2.4);
    expect(statusLightIntensity(2.4, false, true)).toBeCloseTo(3.2);
    expect(statusLightIntensity(2.4, true, false)).toBeCloseTo(3.5);
    expect(statusLightIntensity(2.4, true, true)).toBeCloseTo(3.5);
  });
});
