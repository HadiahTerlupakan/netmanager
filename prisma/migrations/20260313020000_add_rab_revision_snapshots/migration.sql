-- CreateEnum
CREATE TYPE "RabRevisionStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "rab_projects" ADD COLUMN     "finalApprovedRevisionId" TEXT;

-- CreateTable
CREATE TABLE "rab_revisions" (
    "id" TEXT NOT NULL,
    "rabProjectId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "status" "RabRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "totalCapex" BIGINT NOT NULL DEFAULT 0,
    "totalOpex" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rab_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rab_revision_approvals" (
    "id" TEXT NOT NULL,
    "rabRevisionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rab_revision_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rab_revision_items" (
    "id" TEXT NOT NULL,
    "rabRevisionId" TEXT NOT NULL,
    "rabItemId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" BIGINT NOT NULL,
    "totalPrice" BIGINT NOT NULL,
    "category" "RabItemCategory" NOT NULL DEFAULT 'HARDWARE',
    "expenseType" "RabExpenseType" NOT NULL DEFAULT 'CAPEX',
    "expenseCategoryId" TEXT,
    "wbsId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rab_revision_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rab_revisions_rabProjectId_idx" ON "rab_revisions"("rabProjectId");

-- CreateIndex
CREATE INDEX "rab_revisions_status_idx" ON "rab_revisions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "rab_revisions_rabProjectId_revisionNumber_key" ON "rab_revisions"("rabProjectId", "revisionNumber");

-- CreateIndex
CREATE INDEX "rab_revision_approvals_rabRevisionId_idx" ON "rab_revision_approvals"("rabRevisionId");

-- CreateIndex
CREATE INDEX "rab_revision_approvals_userId_idx" ON "rab_revision_approvals"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "rab_revision_approvals_rabRevisionId_userId_key" ON "rab_revision_approvals"("rabRevisionId", "userId");

-- CreateIndex
CREATE INDEX "rab_revision_items_rabRevisionId_idx" ON "rab_revision_items"("rabRevisionId");

-- CreateIndex
CREATE INDEX "rab_revision_items_rabItemId_idx" ON "rab_revision_items"("rabItemId");

-- CreateIndex
CREATE INDEX "rab_revision_items_wbsId_idx" ON "rab_revision_items"("wbsId");

-- CreateIndex
CREATE INDEX "rab_projects_finalApprovedRevisionId_idx" ON "rab_projects"("finalApprovedRevisionId");

-- AddForeignKey
ALTER TABLE "rab_projects" ADD CONSTRAINT "rab_projects_finalApprovedRevisionId_fkey" FOREIGN KEY ("finalApprovedRevisionId") REFERENCES "rab_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_revisions" ADD CONSTRAINT "rab_revisions_rabProjectId_fkey" FOREIGN KEY ("rabProjectId") REFERENCES "rab_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_revision_approvals" ADD CONSTRAINT "rab_revision_approvals_rabRevisionId_fkey" FOREIGN KEY ("rabRevisionId") REFERENCES "rab_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_revision_approvals" ADD CONSTRAINT "rab_revision_approvals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_revision_items" ADD CONSTRAINT "rab_revision_items_rabRevisionId_fkey" FOREIGN KEY ("rabRevisionId") REFERENCES "rab_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

