import { describe, expect, it } from 'vitest';
import { resolveGetUserMediaFailureStatus } from './voice-contribution-recorder-status';

describe('resolveGetUserMediaFailureStatus', () => {
  it('treats an actual permission refusal as permission-denied', () => {
    expect(resolveGetUserMediaFailureStatus(new DOMException('denied', 'NotAllowedError'))).toBe('permission-denied');
  });

  it('treats no microphone attached as a device problem, not a permission one', () => {
    expect(resolveGetUserMediaFailureStatus(new DOMException('no device', 'NotFoundError'))).toBe('device-unavailable');
  });

  it('treats a microphone busy in another app/OS call as a device problem', () => {
    expect(resolveGetUserMediaFailureStatus(new DOMException('busy', 'NotReadableError'))).toBe('device-unavailable');
  });

  it('treats an unrecognised DOMException as a device problem rather than assuming denial', () => {
    expect(resolveGetUserMediaFailureStatus(new DOMException('unsatisfiable', 'OverconstrainedError'))).toBe('device-unavailable');
  });

  it('treats a non-DOMException throw as a device problem', () => {
    expect(resolveGetUserMediaFailureStatus(new Error('unexpected'))).toBe('device-unavailable');
  });
});
