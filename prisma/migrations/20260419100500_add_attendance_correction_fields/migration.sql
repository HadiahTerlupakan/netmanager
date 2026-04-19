ALTER TABLE "Attendance"
  ADD COLUMN IF NOT EXISTS "correctedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "correctedById" TEXT,
  ADD COLUMN IF NOT EXISTS "correctionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "correctionNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "correctionEvidencePhotoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "correctionReplacementAttendanceId" TEXT,
  ADD COLUMN IF NOT EXISTS "correctionSourceAttendanceId" TEXT,
  ADD COLUMN IF NOT EXISTS "correctionSource" TEXT;

CREATE INDEX IF NOT EXISTS "Attendance_tenantId_correctedAt_idx"
  ON "Attendance"("tenantId", "correctedAt");

CREATE INDEX IF NOT EXISTS "Attendance_correctionReplacementAttendanceId_idx"
  ON "Attendance"("correctionReplacementAttendanceId");

CREATE INDEX IF NOT EXISTS "Attendance_correctionSourceAttendanceId_idx"
  ON "Attendance"("correctionSourceAttendanceId");

CREATE UNIQUE INDEX IF NOT EXISTS "Attendance_correctionReplacementAttendanceId_key"
  ON "Attendance"("correctionReplacementAttendanceId");

CREATE UNIQUE INDEX IF NOT EXISTS "Attendance_correctionSourceAttendanceId_key"
  ON "Attendance"("correctionSourceAttendanceId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Attendance_correctedById_fkey'
  ) THEN
    ALTER TABLE "Attendance"
      ADD CONSTRAINT "Attendance_correctedById_fkey"
      FOREIGN KEY ("correctedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Attendance_correctionReplacementAttendanceId_fkey'
  ) THEN
    ALTER TABLE "Attendance"
      ADD CONSTRAINT "Attendance_correctionReplacementAttendanceId_fkey"
      FOREIGN KEY ("correctionReplacementAttendanceId") REFERENCES "Attendance"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Attendance_correctionSourceAttendanceId_fkey'
  ) THEN
    ALTER TABLE "Attendance"
      ADD CONSTRAINT "Attendance_correctionSourceAttendanceId_fkey"
      FOREIGN KEY ("correctionSourceAttendanceId") REFERENCES "Attendance"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
