import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

import { getExpoStaticRewrites } from './expo-static-routes';
import { SAME_ORIGIN_MEDIA_POLICY } from './security-policy';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Next.js 16 writes AGENTS.md/CLAUDE.md into this directory on every
  // `next build` otherwise — noise this scheduled agent's own `git status`
  // would trip over on every future run.
  agentRules: false,
  // The shared workspace packages ship TypeScript sources for the React Native
  // condition, so Next has to compile them rather than treat them as external.
  transpilePackages: [
    '@swasthya/configuration',
    '@swasthya/credentialing',
    '@swasthya/entitlements',
    '@swasthya/shared-types',
  ],
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // The Expo web export lands in public/app as static HTML files (see
  // scripts/vercel-build.sh), and Next's public folder serves those by their
  // literal filename only — it never resolves a bare directory request to
  // its index.html the way a static host would. Without this the footer's
  // `/app` link and Expo's extensionless deep links 404 even though their
  // generated HTML files exist.
  async rewrites() {
    return getExpoStaticRewrites();
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            // The Expo companion is served from the same origin at /app and
            // needs media access after an explicit browser permission grant.
            // Cross-origin frames remain blocked; location and payment stay off.
            value: SAME_ORIGIN_MEDIA_POLICY,
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
