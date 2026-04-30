import { logger, logActivitySafe } from "@/lib/logger";
import { CustomerEventDispatcher } from "@/modules/events";

type SuspensionCustomerResponse = {
  id: string;
  idPelanggan: string;
  nama: string;
  username: string;
  status: string;
} | null;

/** Tambahkan catatan suspend ke pelanggan. */
export function appendLifecycleNote(
  existingNote: string | null,
  reason: string,
  suspensionType: string,
) {
  const suspensionNote = `Service suspended: ${reason} (${suspensionType})`;
  return existingNote ? `${existingNote}\n\n${suspensionNote}` : suspensionNote;
}

/** Tambahkan catatan aktivasi ke pelanggan. */
export function appendActivationNote(
  existingNote: string | null,
  payload: { activationMethod?: string; notes?: string },
) {
  const activationMethod = payload.activationMethod || "MANUAL";
  const activationNote = buildActivationLifecycleNote(
    activationMethod,
    payload.notes,
  );
  return existingNote ? `${existingNote}\n\n${activationNote}` : activationNote;
}

/** Tambahkan notes aktivasi ke record suspend. */
export function appendActivationNotes(
  existingNote: string | null,
  notes?: string,
) {
  if (!notes) return existingNote;
  return `${existingNote || ""}\n\nActivation: ${notes}`.trim();
}

/** Publikasikan log suspend pelanggan. */
export function publishSuspensionLog(
  userId: string,
  pelangganId: string,
  suspensionId: string,
  payload: { suspensionType: string; reason: string },
) {
  logActivitySafe({
    action: "SUSPEND",
    subject: "Pelanggan",
    userId,
    details: buildSuspensionLogDetails(pelangganId, suspensionId, payload),
  });
}

/** Publikasikan log aktivasi pelanggan. */
export function publishActivationLog(
  userId: string,
  pelangganId: string,
  suspensionId: string,
  activationMethod?: string,
) {
  logActivitySafe({
    action: "ACTIVATE",
    subject: "Pelanggan",
    userId,
    details: buildActivationLogDetails(
      pelangganId,
      suspensionId,
      activationMethod,
    ),
  });
}

/** Publikasikan event suspend pelanggan. */
export function publishSuspensionEvent(
  customerId: string,
  customerName: string,
) {
  CustomerEventDispatcher.onSuspended({
    customerId,
    customerName,
    oldStatus: "AKTIF",
    newStatus: "NONAKTIF",
  }).catch((error) =>
    logger.error("Failed to publish CUSTOMER_SUSPENDED event:", error),
  );
}

/** Publikasikan event aktivasi pelanggan. */
export function publishActivationEvent(
  customerId: string,
  customerName: string,
) {
  CustomerEventDispatcher.onActivated({
    customerId,
    customerName,
    oldStatus: "NONAKTIF",
    newStatus: "AKTIF",
  }).catch((error) =>
    logger.error("Failed to publish CUSTOMER_ACTIVATED event:", error),
  );
}

/** Format response suspend pelanggan. */
export function formatSuspendResponse(
  suspension: {
    id: string;
    suspension_type: string;
    reason: string;
    notes: string | null;
    suspended_at: Date;
    expected_resume_at: Date | null;
    suspended_by: string;
    is_active: boolean;
  },
  customer: SuspensionCustomerResponse,
) {
  return {
    success: true,
    message: "Customer service suspended successfully",
    suspension: formatSuspensionResponseBody(suspension),
    customer,
  };
}

/** Format response aktivasi pelanggan. */
export function formatActivateResponse(
  suspension: {
    id: string;
    suspension_type: string;
    reason: string;
    suspended_at: Date;
    actual_resume_at: Date;
    resumed_by: string;
    is_active: boolean;
    notes: string | null;
  },
  customer: SuspensionCustomerResponse,
) {
  return {
    success: true,
    message: "Customer service activated successfully",
    suspension: formatActivationResponseBody(suspension),
    customer,
  };
}

function buildActivationLifecycleNote(
  activationMethod: string,
  notes?: string,
) {
  return `Service reactivated: ${activationMethod}${notes ? ` - ${notes}` : ""}`;
}

function buildSuspensionLogDetails(
  pelangganId: string,
  suspensionId: string,
  payload: { suspensionType: string; reason: string },
) {
  return {
    id: pelangganId,
    type: payload.suspensionType,
    reason: payload.reason,
    suspensionId,
  };
}

function buildActivationLogDetails(
  pelangganId: string,
  suspensionId: string,
  activationMethod?: string,
) {
  return {
    id: pelangganId,
    method: activationMethod || "MANUAL",
    suspensionId,
  };
}

type SuspensionResponseRecord = {
  id: string;
  suspension_type: string;
  reason: string;
  notes: string | null;
  suspended_at: Date;
  expected_resume_at: Date | null;
  suspended_by: string;
  is_active: boolean;
};

type ActivationResponseRecord = {
  id: string;
  suspension_type: string;
  reason: string;
  suspended_at: Date;
  actual_resume_at: Date;
  resumed_by: string;
  is_active: boolean;
  notes: string | null;
};

function formatSuspensionResponseBody(suspension: SuspensionResponseRecord) {
  return {
    ...formatSuspensionResponseIdentity(suspension),
    ...formatSuspensionResponseTimeline(suspension),
    suspendedBy: suspension.suspended_by,
    isActive: suspension.is_active,
  };
}

function formatActivationResponseBody(suspension: ActivationResponseRecord) {
  return {
    ...formatSuspensionResponseIdentity(suspension),
    suspendedAt: suspension.suspended_at.toISOString(),
    actualResumeAt: suspension.actual_resume_at.toISOString(),
    resumedBy: suspension.resumed_by,
    isActive: suspension.is_active,
    notes: suspension.notes,
  };
}

function formatSuspensionResponseIdentity(suspension: {
  id: string;
  suspension_type: string;
  reason: string;
  notes: string | null;
}) {
  return {
    id: suspension.id,
    suspensionType: suspension.suspension_type,
    reason: suspension.reason,
    notes: suspension.notes,
  };
}

function formatSuspensionResponseTimeline(
  suspension: SuspensionResponseRecord,
) {
  return {
    suspendedAt: suspension.suspended_at.toISOString(),
    expectedResumeAt: suspension.expected_resume_at?.toISOString() || null,
  };
}
