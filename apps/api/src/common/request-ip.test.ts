import { describe, expect, it } from 'vitest';
import { requestIp } from './request-ip.js';

describe('requestIp', () => {
  it('prefers request.ip — the value Express derives once trust proxy is set', () => {
    expect(requestIp({ ip: '203.0.113.7', socket: { remoteAddress: '10.0.0.1' } })).toBe('203.0.113.7');
  });

  it('falls back to the socket address when request.ip is absent', () => {
    expect(requestIp({ socket: { remoteAddress: '10.0.0.1' } })).toBe('10.0.0.1');
  });

  it('falls back to a shared "unknown" bucket when neither is available, rather than bypassing the limiter', () => {
    expect(requestIp({})).toBe('unknown');
    expect(requestIp({ socket: {} })).toBe('unknown');
  });
});
