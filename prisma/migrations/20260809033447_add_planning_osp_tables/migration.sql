-- CreateEnum
CREATE TYPE "PlanningType" AS ENUM ('OSP');

-- CreateEnum
CREATE TYPE "PlanningStatus" AS ENUM ('BACKLOG', 'PENDING_APPROVAL', 'APPROVED_LEVEL1', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('SURVEY_PHOTO', 'NETWORK_DIAGRAM', 'TECHNICAL_DRAWING', 'APPROVAL_DOCUMENT', 'COMPLETION_PHOTO', 'OTHER');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATED', 'UPDATED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'STATUS_CHANGED', 'ITEM_ADDED', 'ITEM_REMOVED', 'ITEM_UPDATED', 'MILESTONE_UPDATED', 'DOCUMENT_UPLOADED', 'DOCUMENT_DELETED');

-- CreateTable
CREATE TABLE "Planning" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" TEXT NOT NULL,
    "type" "PlanningType" NOT NULL DEFAULT 'OSP',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "area" TEXT NOT NULL,
    "coordinates" JSONB,
    "estimatedUnits" INTEGER NOT NULL,
    "estimatedBudget" DOUBLE PRECISION,
    "actualBudget" DOUBLE PRECISION,
    "status" "PlanningStatus" NOT NULL DEFAULT 'BACKLOG',
    "approvalLevel" INTEGER NOT NULL DEFAULT 1,
    "currentApprovalStep" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "submittedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedLevel1At" TIMESTAMP(3),
    "approvedLevel1ById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "approvalNotes" TEXT,
    "progressPercentage" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "targetCompletionDate" TIMESTAMP(3),
    "actualCompletionDate" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Planning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningItem" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "planningId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "estimatedPrice" DOUBLE PRECISION,
    "actualPrice" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningMilestone" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "planningId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "actualDate" TIMESTAMP(3),
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningDocument" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "planningId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "category" "DocumentCategory" NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanningDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningAuditLog" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "planningId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "performedById" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changes" JSONB,
    "notes" TEXT,

    CONSTRAINT "PlanningAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningTemplate" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "PlanningType" NOT NULL DEFAULT 'OSP',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningTemplateItem" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "templateId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "estimatedPrice" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Planning_tenantId_idx" ON "Planning"("tenantId");

-- CreateIndex
CREATE INDEX "Planning_status_idx" ON "Planning"("status");

-- CreateIndex
CREATE INDEX "Planning_type_idx" ON "Planning"("type");

-- CreateIndex
CREATE INDEX "Planning_createdAt_idx" ON "Planning"("createdAt");

-- CreateIndex
CREATE INDEX "Planning_tenantId_status_idx" ON "Planning"("tenantId", "status");

-- CreateIndex
CREATE INDEX "PlanningItem_planningId_idx" ON "PlanningItem"("planningId");

-- CreateIndex
CREATE INDEX "PlanningItem_tenantId_idx" ON "PlanningItem"("tenantId");

-- CreateIndex
CREATE INDEX "PlanningMilestone_planningId_idx" ON "PlanningMilestone"("planningId");

-- CreateIndex
CREATE INDEX "PlanningMilestone_tenantId_idx" ON "PlanningMilestone"("tenantId");

-- CreateIndex
CREATE INDEX "PlanningMilestone_status_idx" ON "PlanningMilestone"("status");

-- CreateIndex
CREATE INDEX "PlanningDocument_planningId_idx" ON "PlanningDocument"("planningId");

-- CreateIndex
CREATE INDEX "PlanningDocument_tenantId_idx" ON "PlanningDocument"("tenantId");

-- CreateIndex
CREATE INDEX "PlanningDocument_category_idx" ON "PlanningDocument"("category");

-- CreateIndex
CREATE INDEX "PlanningAuditLog_planningId_idx" ON "PlanningAuditLog"("planningId");

-- CreateIndex
CREATE INDEX "PlanningAuditLog_tenantId_idx" ON "PlanningAuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "PlanningAuditLog_action_idx" ON "PlanningAuditLog"("action");

-- CreateIndex
CREATE INDEX "PlanningAuditLog_performedAt_idx" ON "PlanningAuditLog"("performedAt");

-- CreateIndex
CREATE INDEX "PlanningTemplate_tenantId_idx" ON "PlanningTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "PlanningTemplate_type_idx" ON "PlanningTemplate"("type");

-- CreateIndex
CREATE INDEX "PlanningTemplate_isActive_idx" ON "PlanningTemplate"("isActive");

-- CreateIndex
CREATE INDEX "PlanningTemplateItem_templateId_idx" ON "PlanningTemplateItem"("templateId");

-- CreateIndex
CREATE INDEX "PlanningTemplateItem_tenantId_idx" ON "PlanningTemplateItem"("tenantId");

-- AddForeignKey
ALTER TABLE "Planning" ADD CONSTRAINT "Planning_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Planning" ADD CONSTRAINT "Planning_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Planning" ADD CONSTRAINT "Planning_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Planning" ADD CONSTRAINT "Planning_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Planning" ADD CONSTRAINT "Planning_approvedLevel1ById_fkey" FOREIGN KEY ("approvedLevel1ById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Planning" ADD CONSTRAINT "Planning_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningItem" ADD CONSTRAINT "PlanningItem_planningId_fkey" FOREIGN KEY ("planningId") REFERENCES "Planning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningItem" ADD CONSTRAINT "PlanningItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningMilestone" ADD CONSTRAINT "PlanningMilestone_planningId_fkey" FOREIGN KEY ("planningId") REFERENCES "Planning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningMilestone" ADD CONSTRAINT "PlanningMilestone_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningDocument" ADD CONSTRAINT "PlanningDocument_planningId_fkey" FOREIGN KEY ("planningId") REFERENCES "Planning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningDocument" ADD CONSTRAINT "PlanningDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningDocument" ADD CONSTRAINT "PlanningDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningAuditLog" ADD CONSTRAINT "PlanningAuditLog_planningId_fkey" FOREIGN KEY ("planningId") REFERENCES "Planning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningAuditLog" ADD CONSTRAINT "PlanningAuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningAuditLog" ADD CONSTRAINT "PlanningAuditLog_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningTemplate" ADD CONSTRAINT "PlanningTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningTemplate" ADD CONSTRAINT "PlanningTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningTemplateItem" ADD CONSTRAINT "PlanningTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PlanningTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningTemplateItem" ADD CONSTRAINT "PlanningTemplateItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
