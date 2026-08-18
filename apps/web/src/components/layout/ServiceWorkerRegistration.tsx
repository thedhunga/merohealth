'use client';

import { useEffect } from 'react';

import { registerServiceWorker } from '@/lib/service-worker';

/**
 * Mounted once in the root layout. No UI of its own — registration is a
 * side effect, and `registerServiceWorker` already no-ops outside
 * production or without browser support, so this component can sit in the
 * tree unconditionally rather than needing its own gating.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return null;
}
