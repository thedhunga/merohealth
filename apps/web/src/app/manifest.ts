import type { MetadataRoute } from 'next';

/**
 * Web app manifest — the thing that turns "Add to Home Screen" into a real
 * app icon and a full-screen window on Android (Chrome install prompt) and
 * iOS (Safari share sheet). Owner direction 2026-08-18: perfect the PWA before
 * the store apps, which wait on the API server and developer accounts.
 *
 * Nepali is the product's first language, so the manifest is Nepali; the
 * English site lives at /en and shares the install.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'मेरो स्वास्थ्य — Mero Health',
    short_name: 'मेरो स्वास्थ्य',
    description: 'नेपालीमा स्वास्थ्य प्रश्न सोध्नुहोस्, बोलेर वा लेखेर। आफ्नो र परिवारको स्वास्थ्य विवरण एकै ठाउँमा।',
    id: '/',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'ne',
    dir: 'ltr',
    background_color: '#f5f0e6',
    theme_color: '#171233',
    categories: ['health', 'medical', 'lifestyle'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'प्रश्न सोध्नुहोस्',
        short_name: 'सोध्नुहोस्',
        description: 'स्वास्थ्य सहायकलाई बोलेर वा लेखेर सोध्नुहोस्',
        url: '/get-care?source=pwa-shortcut',
        icons: [{ src: '/icon-192.png', sizes: '192x192' }],
      },
    ],
  };
}
