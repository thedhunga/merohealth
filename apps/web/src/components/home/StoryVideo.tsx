'use client';

import { useEffect, useState } from 'react';

interface StoryVideoProps {
  src: string;
  poster: string;
  label: string;
}

/**
 * This player's wrapper is `hidden lg:block` (`Testimonials.tsx`) — the same
 * shape `LoopVideo` already found: `display:none` doesn't stop a browser
 * from fetching a `<video>`'s poster and, for `preload="metadata"`, however
 * much of the file it takes to locate this MP4's moov atom (measured at
 * 2.6 MB, not a few KB of header, since the atom sits at the end of the
 * file). Deciding whether to render the element at all — matching the same
 * `lg` breakpoint the CSS uses to hide it — is the only fix that actually
 * stops the download below that width, same as the hero loop. Unlike
 * `LoopVideo` this player has visible controls and is never autoplayed, so
 * it doesn't need that component's Save-Data/reduced-motion checks — the
 * only question here is whether the element is even visible.
 */
const LG_BREAKPOINT_QUERY = '(min-width: 1024px)';

export function StoryVideo({ src, poster, label }: StoryVideoProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    setShow(window.matchMedia(LG_BREAKPOINT_QUERY).matches);
  }, []);

  if (!show) return null;

  return (
    <video aria-label={label} className="size-full object-cover" controls playsInline poster={poster} preload="metadata">
      <source src={src} type="video/mp4" />
    </video>
  );
}
