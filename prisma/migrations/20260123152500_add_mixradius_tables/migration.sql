-- CreateTable MixRadiusCustomer
CREATE TABLE IF NOT EXISTS "MixRadiusCustomer" (
    "id" TEXT NOT NULL,
    "mixRadiusId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "fullName" TEXT,
    "address" TEXT,
    "phoneNumber" TEXT,
    "planName" TEXT,
    "status" TEXT,
    "expiredOn" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MixRadiusCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable MixRadiusOwnerGroup
CREATE TABLE IF NOT EXISTS "MixRadiusOwnerGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owners" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MixRadiusOwnerGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable MixRadiusConfig
CREATE TABLE IF NOT EXISTS "MixRadiusConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MixRadiusConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MixRadiusCustomer_mixRadiusId_key" ON "MixRadiusCustomer"("mixRadiusId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MixRadiusCustomer_username_key" ON "MixRadiusCustomer"("username");

-- Add phoneNumber column to registrations if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'registrations' AND column_name = 'phoneNumber') THEN
        ALTER TABLE "registrations" ADD COLUMN "phoneNumber" TEXT;
    END IF;
END $$;
