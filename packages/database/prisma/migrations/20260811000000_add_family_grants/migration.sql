-- CreateEnum
CREATE TYPE "GuardianshipGrounds" AS ENUM ('MINOR', 'INCAPACITY');

-- CreateEnum
CREATE TYPE "DelegationScope" AS ENUM ('VIEW_RECORD', 'ASK_ASSISTANT', 'MANAGE_APPOINTMENTS', 'UPLOAD_DOCUMENTS');

-- CreateEnum
CREATE TYPE "ConsentMethod" AS ENUM ('IN_PERSON_VERBAL', 'WITNESSED', 'CLINICIAN_ATTESTED', 'WRITTEN');

-- CreateTable
CREATE TABLE "GuardianshipGrant" (
    "id" UUID NOT NULL,
    "wardId" UUID NOT NULL,
    "guardianId" UUID NOT NULL,
    "grounds" "GuardianshipGrounds" NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "GuardianshipGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DelegationGrant" (
    "id" UUID NOT NULL,
    "granterId" UUID NOT NULL,
    "delegateId" UUID NOT NULL,
    "scopes" "DelegationScope"[],
    "grantedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "enrolmentMethod" "ConsentMethod",
    "enrolmentRecordedBy" UUID,

    CONSTRAINT "DelegationGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuardianshipGrant_guardianId_idx" ON "GuardianshipGrant"("guardianId");

-- CreateIndex
CREATE INDEX "GuardianshipGrant_wardId_idx" ON "GuardianshipGrant"("wardId");

-- CreateIndex
CREATE INDEX "DelegationGrant_delegateId_idx" ON "DelegationGrant"("delegateId");

-- CreateIndex
CREATE INDEX "DelegationGrant_granterId_idx" ON "DelegationGrant"("granterId");

