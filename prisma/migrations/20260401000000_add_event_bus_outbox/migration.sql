-- CreateTable: OutboxEvent
-- Transactional Outbox Pattern for reliable event delivery
-- Events are persisted here within the same DB transaction as the business operation,
-- then asynchronously dispatched to BullMQ by the outbox processor.

CREATE TABLE IF NOT EXISTS "OutboxEvent" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "priority" INTEGER NOT NULL DEFAULT 3,
    "category" TEXT NOT NULL DEFAULT 'general',

    -- Aggregate reference (optional, for event sourcing)
    "aggregateId" TEXT,
    "aggregateType" TEXT,

    -- Processing state
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 5,
    "lastError" TEXT,

    -- Timestamps
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- Indexes for efficient polling
CREATE INDEX IF NOT EXISTS "OutboxEvent_status_createdAt_idx" ON "OutboxEvent" ("status", "createdAt");
CREATE INDEX IF NOT EXISTS "OutboxEvent_status_scheduledAt_idx" ON "OutboxEvent" ("status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "OutboxEvent_eventName_idx" ON "OutboxEvent" ("eventName");
CREATE INDEX IF NOT EXISTS "OutboxEvent_category_idx" ON "OutboxEvent" ("category");
CREATE INDEX IF NOT EXISTS "OutboxEvent_aggregateId_idx" ON "OutboxEvent" ("aggregateId");
CREATE INDEX IF NOT EXISTS "OutboxEvent_priority_createdAt_idx" ON "OutboxEvent" ("priority", "createdAt");

-- Composite index for the main poll query (status + priority + createdAt)
CREATE INDEX IF NOT EXISTS "OutboxEvent_poll_idx" ON "OutboxEvent" ("status", "priority", "createdAt")
    WHERE "status" = 'PENDING';

-- Index for cleanup of old completed events
CREATE INDEX IF NOT EXISTS "OutboxEvent_cleanup_idx" ON "OutboxEvent" ("status", "processedAt")
    WHERE "status" = 'COMPLETED';

-- Add table comment
COMMENT ON TABLE "OutboxEvent" IS 'Transactional Outbox Pattern: Events are persisted here atomically with business operations, then dispatched to BullMQ queues asynchronously for reliable delivery.';

-- Create enum-like check constraint for status (idempotent)
DO $$ BEGIN
  ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_status_check"
      CHECK ("status" IN ('PENDING', 'PROCESSING', 'COMPLETED', 'DEAD'));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'constraint OutboxEvent_status_check already exists, skipping';
END $$;
