import { describe, expect, it } from 'vitest';
import { UnknownActingSubjectError, resolveActingSubject, type ActingSubject } from './acting-subjects';

const self: ActingSubject = { id: 'local-1', displayName: 'You', relationship: 'SELF' };
const grandmother: ActingSubject = { id: 'sunita', displayName: 'Sunita', relationship: 'DELEGATE' };

describe('resolveActingSubject', () => {
  it('resolves an id present in the authorised list', () => {
    expect(resolveActingSubject([self, grandmother], 'sunita')).toBe(grandmother);
  });

  it('resolves the self subject when it is the only one available', () => {
    expect(resolveActingSubject([self], 'local-1')).toBe(self);
  });

  it('refuses to resolve an id outside the authorised list rather than falling back silently', () => {
    // family-and-proxy.md §1: acting for someone else must never look like
    // acting for yourself — a silent fallback to whatever the caller had
    // before would be exactly that failure, so this must throw, not return.
    expect(() => resolveActingSubject([self], 'someone-else')).toThrow(UnknownActingSubjectError);
  });

  it('refuses a lookup against an empty list', () => {
    expect(() => resolveActingSubject([], 'local-1')).toThrow(UnknownActingSubjectError);
  });
});
