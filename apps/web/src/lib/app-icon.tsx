import { ImageResponse } from 'next/og';

/**
 * The app icon, drawn in code so it renders at any size without a binary
 * asset in the repo: indigo ground, marigold disc, a white health cross.
 * No text — Devanagari would need a bundled font here, and a mark reads
 * better at 48 px anyway. `maskable` pads to Android's safe zone (the inner
 * 80%) so adaptive-icon masks never clip the disc.
 */
export function renderAppIcon(size: number, opts: { maskable?: boolean } = {}) {
  const pad = opts.maskable ? size * 0.1 : 0;
  const inner = size - pad * 2;
  const disc = inner * 0.66;
  const bar = disc * 0.16;
  const arm = disc * 0.56;
  const radius = opts.maskable ? 0 : size * 0.22;

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(160deg, #221C4B 0%, #171233 100%)',
          borderRadius: radius,
        }}
      >
        <div
          style={{
            width: disc,
            height: disc,
            borderRadius: disc / 2,
            background: '#F4A62A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <div style={{ position: 'absolute', width: arm, height: bar, background: '#FFFFFF', borderRadius: bar / 2 }} />
          <div style={{ position: 'absolute', width: bar, height: arm, background: '#FFFFFF', borderRadius: bar / 2 }} />
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
