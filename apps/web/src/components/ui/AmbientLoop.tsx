import Image from 'next/image';

import { LoopVideo } from '@/components/ui/LoopVideo';
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
 *   2. Phone-width viewport, Save-Data, a non-4g connection, or
 *      reduced-motion → poster only; the video element is never rendered,
 *      so the file is never requested (`LoopVideo` decides on the client).
 *   3. Video present but blocked/slow → the poster is behind it.
 *
 * Why the client-side gate: measured on the live homepage at 375 px, the
 * hero loop was 2.5 MB of a 2.85 MB page. `autoplay` makes browsers fetch
 * the file regardless of `preload="metadata"`, and hiding the element with
 * CSS does not stop the download. Most of our users are on Nepali mobile
 * data; a still that never moves beats a hero that never loads.
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

  // The poster is `fill`, so this box must have real size. Callers position
  // it (`absolute inset-0` inside an aspect box is the common case); only
  // when they don't do we fall back to `relative`. Setting `relative`
  // unconditionally fought a caller's `absolute` and collapsed the box to
  // 0 px — the homepage hero rendered as a bare navy slab on every phone.
  const positioned = /\b(absolute|fixed|sticky)\b/.test(className ?? '');

  return (
    <div className={cn('overflow-hidden', positioned ? 'size-full' : 'relative', className)}>
      <Image alt={alt} className="object-cover" fill priority={priority} sizes={sizes} src={poster} />
      {ready ? <LoopVideo poster={poster} src={src} /> : null}
    </div>
  );
}
