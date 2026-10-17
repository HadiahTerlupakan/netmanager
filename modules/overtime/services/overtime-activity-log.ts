import { logActivitySafe, logger } from "@/lib/logger";
import { getTimezone } from "@/lib/utils/get-timezone";
import { formatAttendanceDate } from "@/modules/attendance";

/** Nama aksi Log Aktivitas untuk lembur. */
export const OVERTIME_ACTIVITY_ACTIONS = {
  CREATE: "CREATE",
  START: "START",
  STOP: "STOP",
  AUTO_STOP: "AUTO_STOP",
} as const;

export type OvertimeActivityAction =
  (typeof OVERTIME_ACTIVITY_ACTIONS)[keyof typeof OVERTIME_ACTIVITY_ACTIONS];

/** Pelaku sistem untuk penghentian lembur otomatis. */
export const OVERTIME_AUTO_CHECKOUT_ACTOR = "job:overtime-auto-checkout";

const OVERTIME_SUBJECT = "Lembur";

/**
 * Catat aktivitas lembur dengan subjek `Lembur <tanggal lokal>`. Untuk pelaku
 * sistem, nama karyawan ikut di subjek karena kolom pengguna berisi "System".
 */
export async function recordOvertimeActivity(input: {
  action: OvertimeActivityAction;
  date: Date;
  actor: { userId: string } | { systemId: string; employeeName: string };
  tenantId?: string | null;
  details: Record<string, unknown>;
}): Promise<void> {
  try {
    const timezone = await getTimezone(input.tenantId ?? undefined);
    const dateKey = formatAttendanceDate(input.date, timezone);
    const identity =
      "systemId" in input.actor
        ? {
            subject: `${OVERTIME_SUBJECT} ${input.actor.employeeName} ${dateKey}`,
            actor: { type: "system", id: input.actor.systemId },
          }
        : {
            subject: `${OVERTIME_SUBJECT} ${dateKey}`,
            userId: input.actor.userId,
          };
    logActivitySafe({
      action: input.action,
      ...identity,
      tenantId: input.tenantId ?? undefined,
      details: input.details,
    });
  } catch (error) {
    logger.error("Gagal mencatat log aktivitas lembur", error as Error);
  }
}
