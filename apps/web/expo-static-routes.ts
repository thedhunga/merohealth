export const EXPO_STATIC_ROUTE_PATHS = [
  'capture',
  'care',
  'companion',
  'consent',
  'consultation',
  'learn',
  'records',
  'twin',
] as const;

export function getExpoStaticRewrites() {
  return [
    { source: '/app', destination: '/app/index.html' },
    ...EXPO_STATIC_ROUTE_PATHS.map((path) => ({
      source: `/app/${path}`,
      destination: `/app/${path}.html`,
    })),
  ];
}
