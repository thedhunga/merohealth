import { describe, expect, it } from 'vitest';

import { EXPO_STATIC_ROUTE_PATHS, getExpoStaticRewrites } from '../../expo-static-routes';

describe('Expo static route rewrites', () => {
  it('maps the product root to its generated index file', () => {
    expect(getExpoStaticRewrites()).toContainEqual({
      source: '/app',
      destination: '/app/index.html',
    });
  });

  it.each(EXPO_STATIC_ROUTE_PATHS)('maps /app/%s to its generated HTML file', (path) => {
    expect(getExpoStaticRewrites()).toContainEqual({
      source: `/app/${path}`,
      destination: `/app/${path}.html`,
    });
  });
});
