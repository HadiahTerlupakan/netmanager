import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  getPayrollRunRepository,
  getPayrollEntryRepository,
} from "@/modules/salary";
import { logger } from "@/lib/logger";

const runRepo = getPayrollRunRepository();
const entryRepo = getPayrollEntryRepository();

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["CALCULATING"],
  CALCULATING: ["CALCULATED", "DRAFT"],
  CALCULATED: ["APPROVED", "REVISION_REQUESTED"],
  REVISION_REQUESTED: ["CALCULATING"],
  APPROVED: ["PAID"],
  PAID: [],
};

async function publishSalaryProcessedEvents(
  runId: string,
  tenantId: string,
  periodStart: Date,
) {
  const { eventBus, EVENT_NAMES } = await import("@/lib/event-bus");
  const entries = await entryRepo.findCalculatedSummaries(runId, tenantId);

  const month = periodStart.getMonth() + 1;
  const year = periodStart.getFullYear();

  for (const entry of entries) {
    await eventBus
      .publish(EVENT_NAMES.SALARY_PROCESSED, {
        salaryId: entry.id,
        tenantId,
        userId: entry.userId,
        grossSalary: String(entry.totalEarnings),
        pph21Amount: String(entry.totalTax),
        month,
        year,
        processedAt: new Date().toISOString(),
      })
      .catch((err: unknown) => {
        logger.warn(
          `[SalaryRun] Failed to publish SALARY_PROCESSED for entry ${entry.id}: ${err instanceof Error ? err.message : "unknown"}`,
        );
      });
  }

  logger.info(
    `[SalaryRun] Published SALARY_PROCESSED for ${entries.length} entries in run ${runId}`,
  );
}

/** GET /api/admin/salary/runs/[id] — Get payroll run detail */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("salary:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat data payroll",
    );
  }

  const { id } = ctx.params;
  const tenantId = ctx.session!.user.tenantId!;

  const run = await runRepo.findById(id, tenantId);
  if (!run) {
    return ApiErrors.notFound("Payroll run");
  }

  return apiSuccess({ run });
});

/** PUT /api/admin/salary/runs/[id] — Update payroll run */
export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("salary:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengubah payroll run",
    );
  }

  const { id } = ctx.params;
  const tenantId = ctx.session!.user.tenantId!;
  const body = await req.json();

  const existing = await runRepo.findById(id, tenantId);
  if (!existing) {
    return ApiErrors.notFound("Payroll run");
  }

  if (body.status && body.status !== existing.status) {
    const allowed = VALID_STATUS_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(body.status)) {
      return ApiErrors.badRequest(
        `Transisi status dari ${existing.status} ke ${body.status} tidak diizinkan`,
      );
    }
  }

  const { status, type, ...safeFields } = body;
  const updateData = {
    ...(status && { status }),
    ...(type && { type }),
    ...safeFields,
  };

  const run = await runRepo.update(id, tenantId, updateData);

  if (body.status === "APPROVED" && existing.status !== "APPROVED") {
    publishSalaryProcessedEvents(id, tenantId, existing.periodStart).catch(
      () => {},
    );
  }

  return apiSuccess({ run }, { message: "Payroll run berhasil diperbarui" });
});

/** DELETE /api/admin/salary/runs/[id] — Delete payroll run */
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("salary:delete"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menghapus payroll run",
    );
  }

  const { id } = ctx.params;
  const tenantId = ctx.session!.user.tenantId!;

  const existing = await runRepo.findById(id, tenantId);
  if (!existing) {
    return ApiErrors.notFound("Payroll run");
  }

  if (existing.status !== "DRAFT") {
    return ApiErrors.badRequest(
      "Hanya payroll run berstatus DRAFT yang dapat dihapus",
    );
  }

  await runRepo.delete(id, tenantId);

  return apiSuccess(null, { message: "Payroll run berhasil dihapus" });
});
