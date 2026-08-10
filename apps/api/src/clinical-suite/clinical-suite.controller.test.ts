import { describe, expect, it } from 'vitest';
import type { ResolvedModule } from '@swasthya/module-registry';
import { ClinicalSuiteController } from './clinical-suite.controller.js';
import type { ClinicalSuiteService } from './clinical-suite.service.js';

describe('ClinicalSuiteController', () => {
  it('modules() returns exactly what the service resolves, unmodified', async () => {
    const resolved: ResolvedModule[] = [
      { key: 'HEALTH_RECORDS', available: true, health: 'UP', blockedBy: [], degradations: [] },
    ];
    const service = { resolve: () => Promise.resolve(resolved) } as unknown as ClinicalSuiteService;
    const controller = new ClinicalSuiteController(service);

    await expect(controller.modules()).resolves.toBe(resolved);
  });
});
