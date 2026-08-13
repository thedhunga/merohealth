/**
 * The earliest date `DelegationForm`'s `<input type="date">` should let a
 * person pick for a delegation's `expiresAt`.
 *
 * A bare `YYYY-MM-DD` from the input parses as UTC midnight of that day.
 * `packages/family`'s `grantDelegation` rejects the grant whenever
 * `expiresAt <= grantedAt`, and the server sets `grantedAt` to its own
 * request instant — always later than UTC midnight on the same day. So
 * "today" is never a valid choice: picking it fails 100% of the time, on
 * every timezone and at every hour, with no client-side warning before the
 * round trip. The earliest date that can ever produce a valid `expiresAt`
 * is tomorrow. A flat +24h is safe here — every value in this calculation
 * is UTC, so there is no DST to account for.
 */
export function earliestSelectableExpiryDate(now: Date): string {
  return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
