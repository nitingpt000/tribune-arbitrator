-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('pending', 'in_review', 'resolved', 'cancelled');

-- CreateTable
CREATE TABLE "Dispute" (
    "id" UUID NOT NULL,
    "arbitrable" TEXT NOT NULL,
    "externalDisputeId" TEXT NOT NULL,
    "choices" INTEGER NOT NULL,
    "metadataUri" TEXT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" UUID NOT NULL,
    "disputeId" UUID NOT NULL,
    "submitter" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verdict" (
    "id" UUID NOT NULL,
    "disputeId" UUID NOT NULL,
    "ruling" INTEGER NOT NULL,
    "rationale" TEXT NOT NULL,
    "signedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verdict_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_arbitrable_externalDisputeId_key" ON "Dispute"("arbitrable", "externalDisputeId");

-- CreateIndex
CREATE INDEX "Evidence_disputeId_idx" ON "Evidence"("disputeId");

-- CreateIndex
CREATE UNIQUE INDEX "Verdict_disputeId_key" ON "Verdict"("disputeId");

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verdict" ADD CONSTRAINT "Verdict_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
