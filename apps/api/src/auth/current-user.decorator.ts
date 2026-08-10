import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from './session-auth.guard.js';
import type { CurrentUserResult } from './auth.service.js';

/** Only meaningful on a route behind `SessionAuthGuard` — the guard is what actually populates `request.authUser`. */
export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext): CurrentUserResult | undefined => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.authUser;
});
