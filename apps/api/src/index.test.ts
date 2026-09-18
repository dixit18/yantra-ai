import { describe, expect, it } from 'vitest';
import { API_VERSION, createHealthResponse } from './index.js';

describe('api health', () => {
  it('returns ok with the app version', () => {
    expect(createHealthResponse()).toEqual({ status: 'ok', version: API_VERSION });
  });
});
