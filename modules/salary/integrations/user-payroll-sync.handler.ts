import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { prismaAuth } from "@/modules/database";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";

const SOURCE = "UserPayrollSyncHandler";

/**
 * Handle USER_CREATED event: auto-create EmployeePayrollProfile for new users.
 *
 * Only creates a profile if:
 * - User has a tenantId (non-super-admin)
 * - User is active
 * - A default PaySchedule exists for the tenant
 * - No existing profile already exists for this user+tenant
 */
export async function handleUserCreatedPayrollSync(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const userId = requirePayloadString(payload.userId, "userId", SOURCE);
  const tenantId = payload.tenantId as string | undefined;

  if (!tenantId) {
    logger.debug(
      `[${SOURCE}] User ${userId} has no tenantId, skipping payroll profile creation`,
    );
    return;
  }

  if (payload.isActive === false) {
    logger.debug(
      `[${SOURCE}] User ${userId} is inactive, skipping payroll profile creation`,
    );
    return;
  }

  try {
    // Check if profile already exists
    const existing = await prismaAuth.employeePayrollProfile.findFirst({
      where: { userId, tenantId },
    });
    if (existing) {
      logger.debug(
        `[${SOURCE}] Payroll profile already exists for user ${userId}, skipping`,
      );
      return;
    }

    // Find default pay schedule for tenant
    const defaultSchedule = await prismaAuth.paySchedule.findFirst({
      where: { tenantId, isDefault: true, isActive: true },
    });
    if (!defaultSchedule) {
      logger.warn(
        `[${SOURCE}] No default PaySchedule for tenant ${tenantId}, skipping profile creation for user ${userId}`,
      );
      return;
    }

    // Determine basicSalary and ptkpStatus from payload
    const basicSalary =
      typeof payload.basicSalary === "number" ? payload.basicSalary : 0;
    const ptkpStatus =
      typeof payload.ptkpStatus === "string" ? payload.ptkpStatus : "TK_0";

    await prismaAuth.employeePayrollProfile.create({
      data: {
        userId,
        tenantId,
        employeeType: "PKWTT",
        taxMethod: "NET",
        payScheduleId: defaultSchedule.id,
        basicSalary,
        payPeriodDay: 25,
        ptkpStatus,
        bpjsKesehatan: true,
        bpjsJht: true,
        bpjsJp: true,
        bpjsJkk: true,
        bpjsJkm: true,
        regionCode: "31", // Default Jakarta
        contractStart: new Date(),
        overtimeEligible: true,
        thrEligible: true,
        isActive: true,
      },
    });

    logger.info(
      `[${SOURCE}] Created payroll profile for user ${userId} in tenant ${tenantId}`,
    );
  } catch (error) {
    // Don't break user creation flow — log and continue
    logger.error(
      `[${SOURCE}] Failed to create payroll profile for user ${userId}:`,
      error,
    );
  }
}

/**
 * Handle USER_UPDATED event: sync basicSalary and ptkpStatus to EmployeePayrollProfile.
 *
 * Only syncs if the changed fields include basicSalary or ptkpStatus.
 */
export async function handleUserUpdatedPayrollSync(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const userId = requirePayloadString(payload.userId, "userId", SOURCE);
  const tenantId = payload.tenantId as string | undefined;

  if (!tenantId) {
    return;
  }

  const changedFields = (payload.changedFields as string[]) ?? [];
  const relevantFields = ["basicSalary", "ptkpStatus"];
  const hasRelevantChange = changedFields.some((f) =>
    relevantFields.includes(f),
  );

  if (!hasRelevantChange) {
    return;
  }

  try {
    const profile = await prismaAuth.employeePayrollProfile.findFirst({
      where: { userId, tenantId },
    });

    if (!profile) {
      logger.debug(
        `[${SOURCE}] No payroll profile for user ${userId}, skipping sync`,
      );
      return;
    }

    const updateData: Record<string, unknown> = {};

    if (
      changedFields.includes("basicSalary") &&
      payload.basicSalary !== undefined
    ) {
      updateData.basicSalary =
        typeof payload.basicSalary === "number" ? payload.basicSalary : 0;
    }

    if (
      changedFields.includes("ptkpStatus") &&
      payload.ptkpStatus !== undefined
    ) {
      updateData.ptkpStatus =
        typeof payload.ptkpStatus === "string" ? payload.ptkpStatus : "TK_0";
    }

    if (Object.keys(updateData).length === 0) {
      return;
    }

    await prismaAuth.employeePayrollProfile.update({
      where: { id: profile.id },
      data: updateData,
    });

    logger.info(
      `[${SOURCE}] Synced payroll profile for user ${userId}: ${Object.keys(updateData).join(", ")}`,
    );
  } catch (error) {
    logger.error(
      `[${SOURCE}] Failed to sync payroll profile for user ${userId}:`,
      error,
    );
  }
}

/**
 * Handle USER_DEACTIVATED event: deactivate the user's payroll profile.
 */
export async function handleUserDeactivatedPayrollSync(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const userId = requirePayloadString(payload.userId, "userId", SOURCE);
  const tenantId = payload.tenantId as string | undefined;

  if (!tenantId) {
    return;
  }

  try {
    const profile = await prismaAuth.employeePayrollProfile.findFirst({
      where: { userId, tenantId },
    });

    if (!profile) {
      logger.debug(
        `[${SOURCE}] No payroll profile for user ${userId}, skipping deactivation`,
      );
      return;
    }

    if (!profile.isActive) {
      return;
    }

    await prismaAuth.employeePayrollProfile.update({
      where: { id: profile.id },
      data: { isActive: false },
    });

    logger.info(`[${SOURCE}] Deactivated payroll profile for user ${userId}`);
  } catch (error) {
    logger.error(
      `[${SOURCE}] Failed to deactivate payroll profile for user ${userId}:`,
      error,
    );
  }
}
