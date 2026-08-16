import Image from 'next/image';

import { hasAsset } from '@/lib/assets';
import { cn } from '@/lib/cn';

interface AmbientLoopProps {
  /** Public-root path to a short silent mp4, e.g. `/video/loop-report.mp4`. */
  src: string;
  /** Still to show until the video plays, and forever where video is absent. */
  poster: string;
  alt: string;
  className?: string;
  /** Passed to the poster `<Image>`; the video always fills its box. */
  sizes?: string;
  priority?: boolean;
}

/**
 * A still that breathes.
 *
 * Renders a short muted loop over its own poster frame. Autoplay is only
 * dependable when the element is muted, `playsInline`, and has no audio
 * track at all — every loop in `public/video` is exported that way, and the
 * asset brief says why.
 *
 * Fallbacks stack in this order, so nothing here can ever look broken:
 *   1. No file on disk (build-time `hasAsset`) → poster only.
 *   2. Reduced-motion → poster only; the video is not even requested.
 *   3. Video present but blocked/slow → the poster is behind it.
 *
 * `preload="metadata"` rather than `auto`: on a phone on Nepali mobile data,
 * downloading 2.5 MB before first paint is worse than a still that starts
 * moving a beat later.
 */
export function AmbientLoop({
  src,
  poster,
  alt,
  className,
  sizes = '(min-width: 1024px) 50vw, 100vw',
  priority = false,
}: AmbientLoopProps) {
  const ready = hasAsset(src);

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <Image alt={alt} className="object-cover" fill priority={priority} sizes={sizes} src={poster} />
      {ready ? (
        <video
          aria-hidden
          autoPlay
          className="absolute inset-0 size-full object-cover motion-reduce:hidden"
          loop
          muted
          playsInline
          poster={poster}
          preload="metadata"
          tabIndex={-1}
        >
          <source src={src} type="video/mp4" />
        </video>
      ) : null}
    </div>
  );
}
