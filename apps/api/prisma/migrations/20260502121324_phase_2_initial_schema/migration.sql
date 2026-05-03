-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('PENDING', 'ADJUDICATING', 'SETTLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PanelVoteChoice" AS ENUM ('REFUND', 'REJECT', 'ABSTAIN');

-- CreateEnum
CREATE TYPE "PanelVoteStatus" AS ENUM ('PENDING', 'REASONING', 'VOTED', 'FAILED');

-- CreateEnum
CREATE TYPE "SettlementStepType" AS ENUM ('VERDICT_ONCHAIN', 'KEEPER_CLAIMED', 'FUNDS_RELEASED', 'ENS_REPUTATION');

-- CreateEnum
CREATE TYPE "SettlementStepStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'PENDING',
    "claimantEns" TEXT NOT NULL,
    "respondentEns" TEXT NOT NULL,
    "claimType" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "amountUsdc" DECIMAL(20,6) NOT NULL,
    "arbitrationFee" DECIMAL(20,6) NOT NULL DEFAULT 0.50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageUri" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PanelVote" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "vote" "PanelVoteChoice" NOT NULL DEFAULT 'ABSTAIN',
    "confidence" DECIMAL(3,2) NOT NULL DEFAULT 0.0,
    "reasoning" TEXT NOT NULL DEFAULT '',
    "status" "PanelVoteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PanelVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verdict" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "outcome" "PanelVoteChoice" NOT NULL,
    "votesFor" INTEGER NOT NULL,
    "votesAgainst" INTEGER NOT NULL,
    "totalDurationMs" INTEGER NOT NULL,
    "totalCostUsd" DECIMAL(10,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Verdict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementStep" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "step" "SettlementStepType" NOT NULL,
    "status" "SettlementStepStatus" NOT NULL DEFAULT 'PENDING',
    "txHash" TEXT,
    "detail" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentReputation" (
    "ens" TEXT NOT NULL,
    "totalDisputes" INTEGER NOT NULL DEFAULT 0,
    "disputesWon" INTEGER NOT NULL DEFAULT 0,
    "disputesLost" INTEGER NOT NULL DEFAULT 0,
    "frivolityIndex" DECIMAL(4,2) NOT NULL DEFAULT 0.00,
    "evidenceQualityScore" DECIMAL(3,1) NOT NULL DEFAULT 0.0,
    "lastVerdictId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentReputation_pkey" PRIMARY KEY ("ens")
);

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- CreateIndex
CREATE INDEX "Dispute_claimantEns_idx" ON "Dispute"("claimantEns");

-- CreateIndex
CREATE INDEX "Dispute_respondentEns_idx" ON "Dispute"("respondentEns");

-- CreateIndex
CREATE INDEX "Evidence_disputeId_idx" ON "Evidence"("disputeId");

-- CreateIndex
CREATE INDEX "PanelVote_disputeId_idx" ON "PanelVote"("disputeId");

-- CreateIndex
CREATE UNIQUE INDEX "PanelVote_disputeId_modelName_key" ON "PanelVote"("disputeId", "modelName");

-- CreateIndex
CREATE UNIQUE INDEX "Verdict_disputeId_key" ON "Verdict"("disputeId");

-- CreateIndex
CREATE INDEX "SettlementStep_disputeId_idx" ON "SettlementStep"("disputeId");

-- CreateIndex
CREATE UNIQUE INDEX "SettlementStep_disputeId_step_key" ON "SettlementStep"("disputeId", "step");

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanelVote" ADD CONSTRAINT "PanelVote_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verdict" ADD CONSTRAINT "Verdict_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementStep" ADD CONSTRAINT "SettlementStep_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
