-- CreateTable
CREATE TABLE "SubjectTwinFact" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "provenance" TEXT NOT NULL,
    "verification" TEXT NOT NULL,
    "sensitivity" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubjectTwinFact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubjectTwinFact_userId_idx" ON "SubjectTwinFact"("userId");
