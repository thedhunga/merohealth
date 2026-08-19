-- CreateTable
CREATE TABLE "EarlyAccess" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "contact" TEXT,
    "source" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EarlyAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EarlyAccess_contact_key" ON "EarlyAccess"("contact");

-- CreateIndex
CREATE INDEX "EarlyAccess_userId_idx" ON "EarlyAccess"("userId");
