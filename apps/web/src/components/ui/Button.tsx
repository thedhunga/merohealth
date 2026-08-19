import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

export type ButtonVariant =
  | 'primary'
  | 'accent'
  | 'secondary'
  | 'inverse'
  | 'onDark'
  | 'ghost'
  | 'ghostOnDark';
export type ButtonSize = 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-pill font-semibold whitespace-nowrap transition-[background-color,color,transform] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-indigo-800 text-white hover:bg-indigo-700',
  // Marigold on deep forest is the highest-contrast pairing in the palette,
  // so it is reserved for the single most important action on a screen.
  accent: 'bg-marigold-500 text-indigo-950 hover:bg-marigold-300',
  // `text-ink`, not `text-indigo-800`: `bg-surface` is a theme token (light
  // in light mode, dark in dark mode — see `globals.css`), and a fixed
  // brand-indigo label would go dark-on-dark once it flips.
  secondary: 'bg-surface text-ink ring-1 ring-inset ring-line hover:bg-indigo-50',
  inverse: 'bg-white text-indigo-800 hover:bg-indigo-50',
  onDark: 'bg-white/10 text-white ring-1 ring-inset ring-white/25 hover:bg-white/20',
  ghost: 'text-indigo-800 hover:bg-indigo-50',
  ghostOnDark: 'text-indigo-100 hover:bg-white/10 hover:text-white',
};

const sizes: Record<ButtonSize, string> = {
  // `min-h-11` (44px) clears the tap-target minimum; py-2.5 alone measured
  // 43px in production (ledger 2026-08-16, Google sign-in button).
  md: 'min-h-11 px-5 py-2.5 text-[0.9375rem]',
  lg: 'px-7 py-3.5 text-base',
};

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}

type LinkButtonProps = CommonProps & {
  href: string;
  /** Set for links that leave the marketing site (the Expo app, app stores). */
  external?: boolean;
};

type NativeButtonProps = CommonProps &
  Omit<ComponentPropsWithoutRef<'button'>, 'className' | 'children'>;

export function ButtonLink({
  href,
  external = false,
  variant = 'primary',
  size = 'md',
  className,
  children,
}: LinkButtonProps) {
  const classes = cn(base, variants[variant], sizes[size], className);

  if (external) {
    return (
      <a className={classes} href={href} rel="noreferrer noopener">
        {children}
      </a>
    );
  }

  return (
    <Link className={classes} href={href}>
      {children}
    </Link>
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  type = 'button',
  ...rest
}: NativeButtonProps) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      type={type}
      {...rest}
    >
      {children}
    </button>
  );
}
