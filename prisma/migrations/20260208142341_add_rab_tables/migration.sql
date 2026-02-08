-- CreateEnum
CREATE TYPE "RabStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RabItemCategory" AS ENUM ('HARDWARE', 'LICENSE', 'INSTALLATION', 'OTHER');

-- CreateTable
CREATE TABLE "rab_projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "siteId" TEXT,
    "mixRadiusGroupId" TEXT,
    "projectedRevenue" BIGINT NOT NULL DEFAULT 0,
    "projectedOpex" BIGINT NOT NULL DEFAULT 0,
    "status" "RabStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rab_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rab_items" (
    "id" TEXT NOT NULL,
    "rabProjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" BIGINT NOT NULL,
    "totalPrice" BIGINT NOT NULL,
    "category" "RabItemCategory" NOT NULL DEFAULT 'HARDWARE',

    CONSTRAINT "rab_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rab_projects_siteId_idx" ON "rab_projects"("siteId");

-- CreateIndex
CREATE INDEX "rab_projects_status_idx" ON "rab_projects"("status");

-- CreateIndex
CREATE INDEX "rab_items_rabProjectId_idx" ON "rab_items"("rabProjectId");

-- AddForeignKey
ALTER TABLE "rab_projects" ADD CONSTRAINT "rab_projects_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_projects" ADD CONSTRAINT "rab_projects_mixRadiusGroupId_fkey" FOREIGN KEY ("mixRadiusGroupId") REFERENCES "MixRadiusOwnerGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_projects" ADD CONSTRAINT "rab_projects_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rab_items" ADD CONSTRAINT "rab_items_rabProjectId_fkey" FOREIGN KEY ("rabProjectId") REFERENCES "rab_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
