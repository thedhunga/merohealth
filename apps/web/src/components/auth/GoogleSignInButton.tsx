'use client';

import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { useRouter } from '@/i18n/navigation';
import { migrateAnonymousHistory } from '@/lib/history-api';
import { AuthApiError, verifyGoogleCredential, type AuthIntent } from '@/lib/auth-api';

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleAccountsId {
  initialize(config: { client_id: string; callback: (response: GoogleCredentialResponse) => void }): void;
  prompt(): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

// The subset of `AuthApiError.code` this flow can actually produce —
// `AuthService.verifyGoogleSignIn`'s own thrown codes, plus the shared
// `VALIDATION_ERROR` every zod-parsed route can return. `PhoneOtpFlow` keeps
// its own equivalent list rather than sharing one, since the two flows throw
// disjoint code sets and a shared list would let either accept the other's.
const KNOWN_ERROR_CODES = [
  'GOOGLE_TOKEN_INVALID',
  'GOOGLE_SIGNIN_UNAVAILABLE',
  'ALREADY_REGISTERED',
  'NOT_REGISTERED',
  'VALIDATION_ERROR',
] as const;

/**
 * Round three §D — the second door alongside `PhoneOtpFlow`'s phone form,
 * over the same `mero_session` cookie. Renders nothing at all when
 * `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is absent (build-time env, baked into the
 * bundle — see `apps/web/.env.example`), matching the API side's own
 * `setup-required` degradation so the two never disagree about whether
 * Google sign-in exists.
 *
 * Uses Google Identity Services' `prompt()` from our own styled button
 * rather than `renderButton()`'s auto-rendered widget — the task calls for
 * this site's own copy ("Google मार्फत जारी राख्नुहोस्"), not Google's
 * built-in translations, and a `Button`-styled pill sits as a visual sibling
 * of the phone form's submit button instead of Google's fixed-chrome widget.
 */
export function GoogleSignInButton({ intent, next }: { intent: AuthIntent; next: string | null }) {
  const t = useTranslations('auth.google');
  const errorsT = useTranslations('auth.errors');
  const locale = useLocale() as 'ne' | 'en';
  const router = useRouter();

  const [scriptReady, setScriptReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  const clientId = process.env['NEXT_PUBLIC_GOOGLE_CLIENT_ID'];

  const handleCredential = useCallback(
    (response: GoogleCredentialResponse) => {
      setError(null);
      setPending(true);
      void (async () => {
        try {
          const result = await verifyGoogleCredential({ idToken: response.credential, intent, locale });
          if (result.status === 'setup-required') {
            // The server disagrees about `GOOGLE_CLIENT_ID` being set — an
            // env-parity gap between the two deploys, not a request error.
            setError(errorsT('GOOGLE_SIGNIN_UNAVAILABLE'));
            setPending(false);
            return;
          }
          // Same hand-off `PhoneOtpFlow.handleCodeSubmit` runs after
          // `verifyOtp`: never throws, only clears local history once the
          // server actually has it.
          await migrateAnonymousHistory();
          router.push(next ?? '/account');
        } catch (err) {
          const code = err instanceof AuthApiError ? err.code : null;
          const known = KNOWN_ERROR_CODES.find((candidate) => candidate === code);
          setError(errorsT(known ?? 'GENERIC'));
          setPending(false);
        }
      })();
    },
    [intent, locale, next, router, errorsT],
  );

  useEffect(() => {
    if (!clientId || !scriptReady || initialized.current) return;
    const id = window.google?.accounts?.id;
    if (!id) return;
    id.initialize({ client_id: clientId, callback: handleCredential });
    initialized.current = true;
  }, [clientId, scriptReady, handleCredential]);

  if (!clientId) return null;

  function handleClick() {
    const id = window.google?.accounts?.id;
    if (!id) return;
    setError(null);
    id.prompt();
  }

  return (
    <div className="flex flex-col gap-4">
      <Script onLoad={() => setScriptReady(true)} src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />

      <div aria-hidden="true" className="flex items-center gap-3 text-sm text-ink-soft">
        <span className="h-px flex-1 bg-line" />
        {t('divider')}
        <span className="h-px flex-1 bg-line" />
      </div>

      <FormError message={error} />

      <Button disabled={pending || !scriptReady} onClick={handleClick} type="button" variant="secondary">
        <GoogleMark />
        {t('cta')}
      </Button>
    </div>
  );
}

/** Google's own four-colour "G" logomark, reproduced verbatim per their brand guidelines for a custom sign-in button — not decorative artwork, so it keeps its own fixed colours rather than the brand palette. */
function GoogleMark() {
  return (
    <svg aria-hidden="true" className="h-[18px] w-[18px]" viewBox="0 0 18 18">
      <path
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18z"
        fill="#34A853"
      />
      <path d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03z" fill="#FBBC05" />
      <path
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C12.94.99 10.9.18 9 .18a9 9 0 0 0-8.05 4.79l3 2.33C4.66 5.17 6.65 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}
