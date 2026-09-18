import { describe, expect, it } from 'vitest';
import { APP_NAME } from './index.js';

describe('web wiring', () => {
  it('exposes the app name', () => {
    expect(APP_NAME).toBe('yantra-web');
  });
});
