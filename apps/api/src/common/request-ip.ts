/** The slice of an Express request a rate limiter needs, so callers can pass a plain object in tests. */
export interface IpRequest {
  ip?: string | undefined;
  socket?: { remoteAddress?: string | undefined } | undefined;
}

/**
 * The rate-limiting key for an unauthenticated caller.
 *
 * `request.ip` is only the real client because `bootstrap` sets Express's
 * `trust proxy` — every documented deployment puts exactly one reverse proxy
 * in front of this API (`docs/deployment/dedicated-server.md`), and without
 * that setting `ip` is the proxy's own address, which collapses every
 * visitor in the country into a single shared allowance. `'unknown'` is a
 * real bucket rather than a bypass: a caller we cannot identify shares one
 * allowance with every other such caller, which fails closed.
 */
export function requestIp(request: IpRequest): string {
  return request.ip ?? request.socket?.remoteAddress ?? 'unknown';
}
