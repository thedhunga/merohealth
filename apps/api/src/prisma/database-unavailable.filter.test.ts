import { describe, expect, it } from 'vitest';

import { isDatabaseUnavailable } from './database-unavailable.filter.js';

/**
 * The filter's whole value is in the classifier: too narrow and a real
 * outage surfaces as a 500 that looks like a route bug; too broad and a
 * genuine bug is dressed up as a transient outage and retried forever.
 * These fixtures are shaped like what pg and Prisma actually throw.
 */
describe('isDatabaseUnavailable', () => {
  it('recognises a refused socket from pg (code on the error)', () => {
    const e = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' });
    expect(isDatabaseUnavailable(e)).toBe(true);
  });

  it('recognises DNS failure and timeouts', () => {
    expect(isDatabaseUnavailable(Object.assign(new Error('x'), { code: 'ENOTFOUND' }))).toBe(true);
    expect(isDatabaseUnavailable(Object.assign(new Error('x'), { code: 'ETIMEDOUT' }))).toBe(true);
    expect(isDatabaseUnavailable(Object.assign(new Error('x'), { code: 'EAI_AGAIN' }))).toBe(true);
  });

  it('recognises Prisma initialization and P1xxx connectivity errors', () => {
    const init = new Error("Can't reach database server at `postgres:5432`");
    init.name = 'PrismaClientInitializationError';
    expect(isDatabaseUnavailable(init)).toBe(true);
    expect(isDatabaseUnavailable(Object.assign(new Error('x'), { code: 'P1001' }))).toBe(true);
    expect(isDatabaseUnavailable(Object.assign(new Error('x'), { code: 'P1017' }))).toBe(true);
  });

  it('walks a wrapped cause, since pg nests the socket error', () => {
    const inner = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
    const outer = new Error('query failed', { cause: inner });
    expect(isDatabaseUnavailable(outer)).toBe(true);
  });

  it('does NOT swallow ordinary application errors', () => {
    expect(isDatabaseUnavailable(new Error('patient not found'))).toBe(false);
    expect(isDatabaseUnavailable(new TypeError('x is not a function'))).toBe(false);
    // A Prisma *query* error (bad input, unique violation) is a 4xx/5xx of
    // its own, not an outage.
    expect(isDatabaseUnavailable(Object.assign(new Error('Unique constraint'), { code: 'P2002' }))).toBe(false);
  });

  it('is safe on non-errors and cyclic causes', () => {
    expect(isDatabaseUnavailable(null)).toBe(false);
    expect(isDatabaseUnavailable('string')).toBe(false);
    const cyclic: { cause?: unknown } = {};
    cyclic.cause = cyclic;
    expect(isDatabaseUnavailable(cyclic)).toBe(false);
  });
});
