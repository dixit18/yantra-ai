import { describe, expect, it } from 'vitest';
import { HERO_STEPS, SUBSYSTEMS, SUBSYSTEM_INFO } from '@yantra/3d';
import { APP_NAME } from './index.js';

describe('web wiring', () => {
  it('exposes the app name', () => {
    expect(APP_NAME).toBe('yantra-web');
  });

  it('links the 3d story contract', () => {
    expect(HERO_STEPS).toHaveLength(4);
    for (const id of SUBSYSTEMS) {
      expect(SUBSYSTEM_INFO[id].label.length).toBeGreaterThan(0);
    }
  });
});
