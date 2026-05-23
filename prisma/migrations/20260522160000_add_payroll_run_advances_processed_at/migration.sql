-- Add idempotency marker for advance deductions on PayrollRun.
-- Prevents double-deduction when PUT /runs/[id] status=PAID is called twice or retried.

ALTER TABLE "payroll_run_v2" ADD COLUMN "advancesProcessedAt" TIMESTAMP(3);
