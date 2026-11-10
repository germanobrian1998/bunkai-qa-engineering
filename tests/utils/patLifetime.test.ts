/**
 * Unit tests for the PAT lifetime helper. Run with `bun test tests/utils`.
 * Playwright never collects this file: every project in playwright.config.ts
 * has its own `testMatch`.
 */

import { patLifetimeSeconds } from '@utils/patLifetime';
import { describe, expect, it } from 'bun:test';

const FALLBACK = 86400;

describe('patLifetimeSeconds', () => {
  it('returns the seconds left until a future expiry', () => {
    const inOneHour = new Date(Date.now() + 3600 * 1000).toISOString();
    const seconds = patLifetimeSeconds(inOneHour, FALLBACK);
    expect(seconds).toBeGreaterThanOrEqual(3598);
    expect(seconds).toBeLessThanOrEqual(3600);
  });

  it('clamps an expiry in the past to zero', () => {
    const anHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
    expect(patLifetimeSeconds(anHourAgo, FALLBACK)).toBe(0);
  });

  it('falls back when no expiry is reported', () => {
    expect(patLifetimeSeconds(null, FALLBACK)).toBe(FALLBACK);
    expect(patLifetimeSeconds(undefined, FALLBACK)).toBe(FALLBACK);
    expect(patLifetimeSeconds('', FALLBACK)).toBe(FALLBACK);
  });

  it('falls back instead of returning NaN for an unparseable expiry', () => {
    expect(patLifetimeSeconds('not-a-date', FALLBACK)).toBe(FALLBACK);
  });
});
