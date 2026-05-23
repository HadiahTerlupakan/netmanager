-- CreateEnum
CREATE TYPE "OltCardStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'OFFLINE');

-- CreateTable
CREATE TABLE "olt_cards" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "oltId" TEXT NOT NULL,
    "slotFrame" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "cardType" TEXT,
    "ponCount" INTEGER NOT NULL,
    "status" "OltCardStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "olt_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "olt_cards_oltId_slotFrame_slot_key" ON "olt_cards"("oltId", "slotFrame", "slot");

-- CreateIndex
CREATE INDEX "olt_cards_tenantId_idx" ON "olt_cards"("tenantId");

-- AddForeignKey
ALTER TABLE "olt_cards" ADD CONSTRAINT "olt_cards_oltId_fkey" FOREIGN KEY ("oltId") REFERENCES "olt_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
