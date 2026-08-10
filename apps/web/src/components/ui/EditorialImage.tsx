import Image from 'next/image';
import type { ReactNode } from 'react';

import { hasAsset } from '@/lib/assets';
import { cn } from '@/lib/cn';

interface EditorialImageProps {
  /** Public-root path, e.g. `/imagery/portrait-mina.webp`. */
  src: string;
  alt: string;
  /** Rendered instead when the file is not present. Never a broken image. */
  fallback: ReactNode;
  /** Sizing box. Must establish its own dimensions — the image fills it. */
  className?: string;
  sizes?: string;
  priority?: boolean;
}

/**
 * Photograph with an artwork fallback.
 *
 * The site is designed to be complete without photography: every slot has SVG
 * artwork behind it. This swaps in a real image only once the file actually
 * exists, so assets can land one at a time without any intermediate state
 * where the page looks broken.
 *
 * Source files are large (several MB straight out of a generator); `next/image`
 * re-encodes and resizes them on the way out, so page weight is governed by
 * the rendered size rather than the source.
 */
export function EditorialImage({
  src,
  alt,
  fallback,
  className,
  sizes = '(max-width: 768px) 100vw, 50vw',
  priority = false,
}: EditorialImageProps) {
  if (!hasAsset(src)) {
    return <>{fallback}</>;
  }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <Image alt={alt} className="object-cover" fill priority={priority} sizes={sizes} src={src} />
    </div>
  );
}

/**
 * Same contract for video: renders nothing at all when the file is absent, so
 * a caller can wrap it in the layout it would otherwise occupy.
 */
export function hasVideo(src: string): boolean {
  return hasAsset(src);
}
