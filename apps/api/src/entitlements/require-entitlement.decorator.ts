import { SetMetadata } from '@nestjs/common';
import type { ModuleKey, QuotaDimension } from '@swasthya/shared-types';

export const REQUIRED_MODULE_KEY = 'entitlements:requiredModule';
export const REQUIRED_QUOTA_KEY = 'entitlements:requiredQuota';

/**
 * Marks a route as requiring `module` to be in the caller's plan.
 * `EntitlementsGuard` reads this metadata; the decorator alone enforces
 * nothing — a route without `@UseGuards(EntitlementsGuard)` still runs open.
 */
export const RequireModule = (module: ModuleKey) => SetMetadata(REQUIRED_MODULE_KEY, module);

/**
 * Marks a route as requiring headroom on `dimension` before it runs. The
 * guard resolves "used so far" through the module's own `UsageReader`
 * binding — this decorator only names which dimension to check.
 */
export const RequireQuota = (dimension: QuotaDimension) => SetMetadata(REQUIRED_QUOTA_KEY, dimension);
