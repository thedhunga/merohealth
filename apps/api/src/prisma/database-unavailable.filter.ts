import { ArgumentsHost, Catch, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Response } from 'express';

/**
 * Turns "the database is unreachable" into a clean 503, everywhere.
 *
 * `PrismaService` connects lazily, so the API boots and `/v1/health` answers
 * even with no Postgres. But the first route that actually queries would
 * otherwise surface the driver's connection error as a bare 500 with a stack
 * trace — the worst possible shape for a health product: it looks like a
 * bug in the route, not an outage, and it tells the caller nothing about
 * whether to retry.
 *
 * This filter recognises the connection-level failures (refused, DNS,
 * timeout, pool exhausted, Prisma's own init/rust-panic classes) and answers
 * `503 DATABASE_UNAVAILABLE` with `Retry-After`. Everything else passes
 * through untouched — a genuine 500 must stay a 500.
 *
 * Fault isolation, in one sentence: a dead database degrades every
 * data-backed route to a truthful 503 and leaves health, docs, and the
 * research route (which never touches the DB) working exactly as before.
 */

const CONNECTION_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ECONNRESET',
  'EHOSTUNREACH',
  'EAI_AGAIN',
  // Prisma engine-level connectivity codes.
  'P1000',
  'P1001',
  'P1002',
  'P1003',
  'P1008',
  'P1017',
]);

const CONNECTION_NAMES = new Set([
  'PrismaClientInitializationError',
  'PrismaClientRustPanicError',
]);

interface ErrorLike {
  name?: unknown;
  code?: unknown;
  message?: unknown;
  cause?: unknown;
}

export function isDatabaseUnavailable(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== 'object' || depth > 4) return false;
  const e = error as ErrorLike;
  if (typeof e.name === 'string' && CONNECTION_NAMES.has(e.name)) return true;
  if (typeof e.code === 'string' && CONNECTION_CODES.has(e.code)) return true;
  if (typeof e.message === 'string' && /can't reach database server|connection (refused|terminated)|timed out (fetching|acquiring)/i.test(e.message)) {
    return true;
  }
  // pg wraps the socket error as `cause`; walk it rather than trusting the top.
  return isDatabaseUnavailable(e.cause, depth + 1);
}

@Catch()
export class DatabaseUnavailableFilter extends BaseExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost): void {
    if (!isDatabaseUnavailable(exception)) {
      // Not ours. Hand it to Nest's default handling so HttpExceptions,
      // validation errors and genuine 500s behave exactly as before.
      super.catch(exception, host);
      return;
    }
    const response = host.switchToHttp().getResponse<Response>();
    response
      .status(HttpStatus.SERVICE_UNAVAILABLE)
      .setHeader('Retry-After', '10')
      .json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        code: 'DATABASE_UNAVAILABLE',
        message: 'The database is temporarily unreachable. Please retry shortly.',
      });
  }
}
