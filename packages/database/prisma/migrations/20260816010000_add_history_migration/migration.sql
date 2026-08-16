-- CreateTable
CREATE TABLE "HistoryMigration" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "anonymousId" TEXT NOT NULL,
    "profileSnapshot" JSONB,
    "migratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoryMigration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoryExchange" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "askedAt" TIMESTAMP(3) NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "language" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoryExchange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HistoryMigration_anonymousId_key" ON "HistoryMigration"("anonymousId");

-- CreateIndex
CREATE INDEX "HistoryMigration_userId_idx" ON "HistoryMigration"("userId");

-- CreateIndex
CREATE INDEX "HistoryExchange_userId_askedAt_idx" ON "HistoryExchange"("userId", "askedAt");
