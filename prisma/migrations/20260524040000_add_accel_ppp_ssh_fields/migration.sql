-- AlterTable
ALTER TABLE "AccelPppServer"
    ADD COLUMN "sshHost" TEXT,
    ADD COLUMN "sshPort" INTEGER NOT NULL DEFAULT 22,
    ADD COLUMN "sshUser" TEXT,
    ADD COLUMN "sshPassword" TEXT,
    ADD COLUMN "sshPrivateKey" TEXT,
    ADD COLUMN "lastProvisionAt" TIMESTAMP(3),
    ADD COLUMN "lastProvisionStatus" TEXT;
