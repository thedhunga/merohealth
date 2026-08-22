import { describe, expect, it } from 'vitest';
import { resolveSessionState, resolveSignInRedirect } from './session-redirect';

describe('resolveSignInRedirect', () => {
  it('sends an anonymous visitor to /signin carrying the page they were trying to reach', () => {
    expect(resolveSignInRedirect('anonymous', '/clinicians/register')).toEqual({
      pathname: '/signin',
      query: { next: '/clinicians/register' },
    });
  });

  it('does not redirect while the session query is still loading', () => {
    expect(resolveSignInRedirect('loading', '/account')).toBeNull();
  });

  it('does not redirect once the visitor is authenticated', () => {
    expect(resolveSignInRedirect('authenticated', '/account')).toBeNull();
  });
});

describe('resolveSessionState', () => {
  it('collapses anonymous into loading — the redirect is in flight, still nothing to render', () => {
    expect(resolveSessionState({ status: 'anonymous' })).toEqual({ status: 'loading' });
  });

  it('passes loading through unchanged', () => {
    expect(resolveSessionState({ status: 'loading' })).toEqual({ status: 'loading' });
  });

  it('passes an authenticated session through unchanged, user payload included', () => {
    const authenticated = {
      status: 'authenticated' as const,
      user: { id: 'user-1', phone: '+9779800000000' } as never,
    };
    expect(resolveSessionState(authenticated)).toBe(authenticated);
  });
});
