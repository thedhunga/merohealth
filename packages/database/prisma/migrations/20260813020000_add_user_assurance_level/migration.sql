-- CreateEnum
CREATE TYPE "AssuranceLevel" AS ENUM ('REGISTERED', 'IDENTITY_VERIFIED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "assuranceLevel" "AssuranceLevel" NOT NULL DEFAULT 'REGISTERED';
