import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

export type ButtonVariant =
  | 'primary'
  | 'accent'
  | 'secondary'
  | 'inverse'
  | 'onDark'
  | 'ghost';
export type ButtonSize = 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-pill font-semibold whitespace-nowrap transition-[background-color,color,transform] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-forest-700 text-white hover:bg-forest-600',
  // Marigold on deep forest is the highest-contrast pairing in the palette,
  // so it is reserved for the single most important action on a screen.
  accent: 'bg-marigold-500 text-forest-900 hover:bg-marigold-300',
  secondary: 'bg-white text-forest-700 ring-1 ring-inset ring-line hover:bg-jade-50',
  inverse: 'bg-white text-forest-700 hover:bg-jade-50',
  onDark: 'bg-white/10 text-white ring-1 ring-inset ring-white/25 hover:bg-white/20',
  ghost: 'text-forest-700 hover:bg-jade-50',
};

const sizes: Record<ButtonSize, string> = {
  md: 'px-5 py-2.5 text-[0.9375rem]',
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
