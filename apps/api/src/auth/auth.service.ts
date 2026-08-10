import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  generateOtpCode,
  generateSessionToken,
  hashOtpCode,
  hashSessionToken,
  InvalidPhoneError,
  isOtpChallengeUsable,
  isOtpResendAllowed,
  isSessionActive,
  normalizeNepaliPhone,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  SESSION_TTL_MS,
  verifyOtpCode,
} from '@swasthya/auth';
import { raiseAssurance } from '@swasthya/identity';
import type { AssuranceLevel } from '@swasthya/shared-types';
import { AUTH_STORE, type AuthStore, type AuthUserRecord } from './auth-store.js';
import { SMS_PROVIDER, type SmsProvider } from './sms-provider.js';

export type AuthIntent = 'SIGN_IN' | 'REGISTER';

export interface RequestOtpResult {
  challengeId: string;
  expiresAt: Date;
  /** Only set outside production, with the mock SMS provider — see the doc comment below. */
  debugCode?: string;
}

export interface VerifyOtpInput {
  challengeId: string;
  code: string;
  phone: string;
  intent: AuthIntent;
  // `| undefined`, not just `?:` — zod's `.optional()` infers exactly this
  // union for a caller built from parsed input, and `exactOptionalPropertyTypes`
  // treats "key absent" and "key present with value `undefined`" as distinct.
  displayName?: string | undefined;
  locale?: string | undefined;
}

export interface VerifyOtpResult {
  token: string;
  expiresAt: Date;
  user: AuthUserRecord;
  patientProfileId: string | null;
  assuranceLevel: AssuranceLevel;
}

export interface CurrentUserResult {
  subjectId: string;
  user: AuthUserRecord;
  patientProfileId: string | null;
  assuranceLevel: AssuranceLevel;
}

/** `AUTH_SECRET` from `.env.example` — required, not defaulted: a predictable secret would make every OTP hash and session token forgeable. */
function authSecret(): string {
  const secret = process.env['AUTH_SECRET'];
  if (!secret) {
    throw new Error('AUTH_SECRET must be set — see .env.example');
  }
  return secret;
}

/**
 * Phone + OTP to `REGISTERED` (identity-and-credentialing.md §2) plus
 * session issuance — Round two A3. `packages/identity` supplies the
 * assurance-ladder rule (`raiseAssurance`); everything else — OTP
 * generation/expiry/delivery, session tokens — is new here, per that
 * package's own doc comment that it deliberately does not perform the check
 * itself.
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_STORE) private readonly store: AuthStore,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  async requestOtp(rawPhone: string): Promise<RequestOtpResult> {
    const phone = parsePhone(rawPhone);
    const now = new Date();

    const latest = await this.store.latestOtpChallengeForPhone(phone);
    if (!isOtpResendAllowed(latest, now)) {
      throw new HttpException(
        { code: 'OTP_COOLDOWN', message: 'A code was already sent — wait before requesting another' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = generateOtpCode();
    const codeHash = hashOtpCode(code, authSecret());
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
    const challenge = await this.store.createOtpChallenge({ phone, codeHash, expiresAt, createdAt: now });

    await this.sms.send(phone, `Your Mero Health verification code is ${code}. It expires in 5 minutes.`);

    return {
      challengeId: challenge.id,
      expiresAt,
      // Omitted entirely in production, and only present because the
      // shipped SMS adapter is a mock that logs instead of delivering — a
      // real gateway means a real phone actually received the code, so
      // there is nothing left for this field to help with. Without it, this
      // repo would have no way to exercise the verify step end-to-end short
      // of reading server logs for every manual test. A conditional spread,
      // not `debugCode: ... ? code : undefined` — `exactOptionalPropertyTypes`
      // treats an explicit `undefined` value differently from the key being
      // absent, and "absent" is what this field's own type promises.
      ...(process.env['NODE_ENV'] !== 'production' ? { debugCode: code } : {}),
    };
  }

  async verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResult> {
    const phone = parsePhone(input.phone);
    const now = new Date();

    const challenge = await this.store.findOtpChallenge(input.challengeId);
    if (!challenge || challenge.phone !== phone) {
      throw new BadRequestException({ code: 'OTP_CHALLENGE_NOT_FOUND', message: 'No such verification code' });
    }
    if (!isOtpChallengeUsable(challenge, now)) {
      const reason = challenge.attempts >= OTP_MAX_ATTEMPTS ? 'OTP_ATTEMPTS_EXCEEDED' : 'OTP_EXPIRED';
      throw new BadRequestException({
        code: reason,
        message: reason === 'OTP_ATTEMPTS_EXCEEDED' ? 'Too many incorrect attempts — request a new code' : 'This code has expired — request a new one',
      });
    }

    if (!verifyOtpCode(input.code, authSecret(), challenge.codeHash)) {
      await this.store.recordFailedOtpAttempt(challenge.id);
      throw new BadRequestException({
        code: 'OTP_INCORRECT',
        message: 'Incorrect code',
        attemptsRemaining: Math.max(0, OTP_MAX_ATTEMPTS - challenge.attempts - 1),
      });
    }
    await this.store.consumeOtpChallenge(challenge.id, now);

    let user = await this.store.findUserByPhone(phone);
    if (input.intent === 'REGISTER') {
      if (user) {
        throw new ConflictException({ code: 'ALREADY_REGISTERED', message: 'This phone number already has an account — sign in instead' });
      }
      const displayName = input.displayName?.trim();
      if (!displayName) {
        throw new BadRequestException({ code: 'DISPLAY_NAME_REQUIRED', message: 'A name is required to register' });
      }
      user = await this.store.createPatientUser({ phone, locale: input.locale ?? 'ne' });
      await this.store.createPatientProfile({ userId: user.id, displayName });
    } else {
      if (!user) {
        throw new NotFoundException({ code: 'NOT_REGISTERED', message: 'No account found for this phone number — register instead' });
      }
    }

    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token, authSecret());
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    await this.store.createSession({ userId: user.id, tokenHash, expiresAt, createdAt: now });

    const patientProfile = await this.store.findPatientProfileByUserId(user.id);

    return {
      token,
      expiresAt,
      user,
      patientProfileId: patientProfile?.id ?? null,
      // Every `User` row this service creates was reached by phone + OTP,
      // and there is no other creation path into this table — so the
      // transition is always the same legal `ANONYMOUS → REGISTERED` step
      // `raiseAssurance` exists to guard, never a shortcut around it.
      assuranceLevel: raiseAssurance('ANONYMOUS', 'REGISTERED'),
    };
  }

  /** Resolves a bearer/cookie session token to the identity behind it — the "real subjectId on every request" this task exists to deliver. `null`, not a thrown error, on anything invalid: an expired or forged token is a normal outcome for a guard to check, not exceptional. */
  async currentUser(token: string): Promise<CurrentUserResult | null> {
    const tokenHash = hashSessionToken(token, authSecret());
    const session = await this.store.findSessionByTokenHash(tokenHash);
    if (!session || !isSessionActive(session, new Date())) return null;

    const user = await this.store.findUserById(session.userId);
    if (!user) return null;

    const patientProfile = await this.store.findPatientProfileByUserId(user.id);
    return {
      subjectId: user.id,
      user,
      patientProfileId: patientProfile?.id ?? null,
      assuranceLevel: 'REGISTERED',
    };
  }

  async requireCurrentUser(token: string | null): Promise<CurrentUserResult> {
    const result = token ? await this.currentUser(token) : null;
    if (!result) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Sign in required' });
    }
    return result;
  }

  async logout(token: string): Promise<void> {
    const tokenHash = hashSessionToken(token, authSecret());
    const session = await this.store.findSessionByTokenHash(tokenHash);
    if (session) await this.store.revokeSession(session.id, new Date());
  }
}

function parsePhone(rawPhone: string): string {
  try {
    return normalizeNepaliPhone(rawPhone);
  } catch (error) {
    if (error instanceof InvalidPhoneError) {
      throw new BadRequestException({ code: 'INVALID_PHONE', message: error.message });
    }
    throw error;
  }
}
