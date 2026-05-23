import { randomUUID } from "crypto";
import * as z from "zod";

import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { logActivitySafe } from "@/lib/logger";
import {
  buildTenantUploadDir,
  validateUploadFile,
} from "@/lib/upload/upload-policy";
import { getTimezone } from "@/lib/utils/get-timezone";
import { convertAndSaveImage } from "@/lib/utils/image-upload";
import { attendanceMissedCheckInCorrectionSchema } from "@/lib/validations/attendance";
import { idSchema } from "@/lib/validations/common";
import { AttendanceCorrectionService } from "@/modules/attendance";
import { fromZonedTime } from "date-fns-tz";

const ATTENDANCE_UPLOAD_DIR = "public/uploads/employee/attendance";
const ATTENDANCE_UPLOAD_FOLDER = "uploads";

function getFormValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeDateTimeInput(
  value: string | undefined,
  timezone: string,
): string | undefined {
  if (!value) {
    return undefined;
  }

  if (value.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(value)) {
    return value;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return fromZonedTime(`${value}:00`, timezone).toISOString();
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) {
    return fromZonedTime(value, timezone).toISOString();
  }

  return value;
}

function buildEvidencePhotoName(userId: string): string {
  return `${userId}-${Date.now()}-${randomUUID()}`;
}

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("attendance:correct-missed-checkin"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const user = ctx.session!.user;
  const tenantId = user.tenantId;

  if (!tenantId) {
    return ApiErrors.badRequest("Tenant ID tidak ditemukan");
  }

  const idResult = idSchema.safeParse(ctx.params.id);
  if (!idResult.success) {
    return ApiErrors.badRequest("ID tidak valid");
  }

  const timezone = await getTimezone(tenantId);
  const formData = await req.formData();
  const photo = formData.get("photo");

  if (!(photo instanceof File)) {
    return ApiErrors.badRequest("Foto bukti wajib diupload");
  }

  const uploadValidation = validateUploadFile({
    folder: ATTENDANCE_UPLOAD_FOLDER,
    mimeType: photo.type,
    size: photo.size,
    fileName: photo.name,
  });

  if (!uploadValidation.ok) {
    return ApiErrors.badRequest(
      uploadValidation.error ?? "File foto tidak valid",
    );
  }

  const payloadResult = attendanceMissedCheckInCorrectionSchema.safeParse({
    checkIn: normalizeDateTimeInput(
      getFormValue(formData, "checkIn"),
      timezone,
    ),
    checkOut:
      normalizeDateTimeInput(getFormValue(formData, "checkOut"), timezone) ??
      null,
    reason: getFormValue(formData, "reason"),
    notes: getFormValue(formData, "notes") ?? null,
    evidencePhotoUrl: "pending-upload",
  });

  if (!payloadResult.success) {
    return ApiErrors.badRequest("Data tidak valid", {
      errors: z.flattenError(payloadResult.error).fieldErrors,
    });
  }

  const evidencePhotoUrl = await convertAndSaveImage(
    photo,
    buildTenantUploadDir(ATTENDANCE_UPLOAD_DIR, tenantId),
    buildEvidencePhotoName(user.id),
    "employee-attendance",
    user.id,
  );

  const payload = {
    ...payloadResult.data,
    evidencePhotoUrl,
  };
  const service = new AttendanceCorrectionService();

  const result = await service.correctMissedCheckIn({
    sourceAttendanceId: idResult.data,
    tenantId,
    actorId: user.id,
    checkIn: new Date(payload.checkIn),
    checkOut: payload.checkOut ? new Date(payload.checkOut) : null,
    reason: payload.reason,
    notes: payload.notes,
    evidencePhotoUrl: payload.evidencePhotoUrl,
  });

  logActivitySafe({
    action: "CREATE",
    subject: "AttendanceCorrection",
    userId: user.id,
    details: {
      sourceAttendanceId: idResult.data,
      correctedAttendanceId: result.correctedAttendance.id,
      correctionType: "MISSED_CHECKIN",
    },
  });

  return apiSuccess(result, {
    message: "Koreksi missed check-in berhasil disimpan",
  });
});
