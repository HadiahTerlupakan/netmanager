-- CreateTable (Idempotent)
CREATE TABLE IF NOT EXISTS "user_sites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (Idempotent)
CREATE INDEX IF NOT EXISTS "user_sites_userId_idx" ON "user_sites"("userId");
CREATE INDEX IF NOT EXISTS "user_sites_siteId_idx" ON "user_sites"("siteId");

-- CreateUnique (Idempotent - will fail if exists but that's ok)
DO $$
BEGIN
    ALTER TABLE "user_sites" ADD CONSTRAINT "user_sites_userId_siteId_key" UNIQUE ("userId", "siteId");
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey (Idempotent)
DO $$
BEGIN
    ALTER TABLE "user_sites" ADD CONSTRAINT "user_sites_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
    ALTER TABLE "user_sites" ADD CONSTRAINT "user_sites_siteId_fkey" 
        FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Migrate existing siteId data to user_sites (Idempotent)
INSERT INTO "user_sites" ("id", "userId", "siteId", "isPrimary", "createdAt")
SELECT 
    gen_random_uuid()::text,
    "id" as "userId",
    "siteId",
    true as "isPrimary",
    NOW() as "createdAt"
FROM "User"
WHERE "siteId" IS NOT NULL
ON CONFLICT ("userId", "siteId") DO NOTHING;
