import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthStore, AuthUserRecord, OtpChallengeRecord, SessionRecord } from './auth-store.js';

/** The real `AuthStore`, backing everything with the tables Round two A3 added to `packages/database`'s schema. */
@Injectable()
export class PrismaAuthStore implements AuthStore {
  constructor(private readonly prisma: PrismaService) {}

  async createOtpChallenge(input: {
    phone: string;
    codeHash: string;
    expiresAt: Date;
    createdAt: Date;
  }): Promise<OtpChallengeRecord> {
    return this.prisma.client.otpChallenge.create({
      data: {
        phone: input.phone,
        codeHash: input.codeHash,
        expiresAt: input.expiresAt,
        createdAt: input.createdAt,
      },
    });
  }

  async latestOtpChallengeForPhone(phone: string): Promise<OtpChallengeRecord | null> {
    return this.prisma.client.otpChallenge.findFirst({
      where: { phone },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOtpChallenge(id: string): Promise<OtpChallengeRecord | null> {
    return this.prisma.client.otpChallenge.findUnique({ where: { id } });
  }

  async recordFailedOtpAttempt(id: string): Promise<void> {
    await this.prisma.client.otpChallenge.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  }

  async consumeOtpChallenge(id: string, consumedAt: Date): Promise<void> {
    await this.prisma.client.otpChallenge.update({ where: { id }, data: { consumedAt } });
  }

  async findUserByPhone(phone: string): Promise<AuthUserRecord | null> {
    return this.prisma.client.user.findUnique({ where: { phone } });
  }

  async findUserById(userId: string): Promise<AuthUserRecord | null> {
    return this.prisma.client.user.findUnique({ where: { id: userId } });
  }

  async createPatientUser(input: { phone: string; locale: string }): Promise<AuthUserRecord> {
    return this.prisma.client.user.create({
      data: { phone: input.phone, role: 'PATIENT', locale: input.locale },
    });
  }

  async findUserByGoogleSub(googleSub: string): Promise<AuthUserRecord | null> {
    return this.prisma.client.user.findUnique({ where: { googleSub } });
  }

  async createGoogleUser(input: { googleSub: string; email: string; locale: string }): Promise<AuthUserRecord> {
    return this.prisma.client.user.create({
      data: { googleSub: input.googleSub, email: input.email, role: 'PATIENT', locale: input.locale },
    });
  }

  async createPatientProfile(input: { userId: string; displayName: string }): Promise<{ id: string }> {
    return this.prisma.client.patientProfile.create({
      data: { userId: input.userId, displayName: input.displayName },
      select: { id: true },
    });
  }

  async findPatientProfileByUserId(userId: string): Promise<{ id: string } | null> {
    return this.prisma.client.patientProfile.findUnique({ where: { userId }, select: { id: true } });
  }

  async createSession(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    createdAt: Date;
  }): Promise<SessionRecord> {
    return this.prisma.client.session.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        createdAt: input.createdAt,
      },
    });
  }

  async findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    return this.prisma.client.session.findUnique({ where: { tokenHash } });
  }

  async revokeSession(id: string, revokedAt: Date): Promise<void> {
    await this.prisma.client.session.update({ where: { id }, data: { revokedAt } });
  }

  async markIdentityVerified(userId: string): Promise<void> {
    await this.prisma.client.user.update({ where: { id: userId }, data: { assuranceLevel: 'IDENTITY_VERIFIED' } });
  }
}
