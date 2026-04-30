import { logger } from "@/lib/logger";
import { prisma } from "@/modules/database";
import { Status } from "../types/pelanggan.enums";
import {
  appendActivationNote,
  appendActivationNotes,
  appendLifecycleNote,
  formatActivateResponse,
  formatSuspendResponse,
  publishActivationEvent,
  publishActivationLog,
  publishSuspensionEvent,
  publishSuspensionLog,
} from "./pelanggan-ppp-route-helpers";
import type { RadiusSyncService } from "@/modules/network";

export type LifecycleCustomer = {
  id: string;
  nama: string;
  username: string;
  status: string;
  tenantId: string | null;
  catatan: string | null;
};

export type SuspendPayload = {
  suspensionType: "PAYMENT" | "VIOLATION" | "MAINTENANCE" | "REQUEST";
  reason: string;
  notes?: string;
  expectedResumeAt?: string;
  terminateActiveSessions: boolean;
};

export type ActivatePayload = {
  notes?: string;
  activationMethod?: "MANUAL" | "AUTOMATIC" | "PAYMENT_CONFIRMED";
  syncToRadius: boolean;
};

const LIFECYCLE_RESPONSE_SELECT = {
  id: true,
  idPelanggan: true,
  nama: true,
  username: true,
  status: true,
} as const;

const buildSuspensionCreateData = (
  pelanggan: LifecycleCustomer,
  input: { pelangganId: string; userId: string; payload: SuspendPayload },
) => ({
  id: crypto.randomUUID(),
  pelangganId: input.pelangganId,
  suspension_type: input.payload.suspensionType,
  reason: input.payload.reason,
  notes: input.payload.notes,
  expected_resume_at: input.payload.expectedResumeAt
    ? new Date(input.payload.expectedResumeAt)
    : null,
  suspended_by: input.userId,
  is_active: true,
  tenantId: pelanggan.tenantId,
  updated_at: new Date(),
});

type PelangganLifecycleTransaction = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

const updateCustomerStatus = (
  tx: PelangganLifecycleTransaction,
  pelangganId: string,
  status: Status,
) =>
  tx.pelanggan.update({
    where: { id: pelangganId },
    data: { status, updatedAt: new Date() },
  });

const updateCustomerNote = (
  tx: PelangganLifecycleTransaction,
  pelangganId: string,
  catatan: string | null,
) =>
  tx.pelanggan.update({
    where: { id: pelangganId },
    data: { catatan },
  });

/** Load minimal lifecycle response after suspend or activate flow. */
export const getLifecycleCustomerResponse = (id: string) =>
  prisma.pelanggan.findUnique({
    where: { id },
    select: LIFECYCLE_RESPONSE_SELECT,
  });

/** Persist customer suspension transaction. */
export const persistCustomerSuspension = (
  pelanggan: LifecycleCustomer,
  input: { pelangganId: string; userId: string; payload: SuspendPayload },
) =>
  prisma.$transaction(async (tx) => {
    const suspension = await tx.serviceSuspension.create({
      data: buildSuspensionCreateData(pelanggan, input),
    });

    await updateCustomerStatus(tx, input.pelangganId, Status.NONAKTIF);
    await updateCustomerNote(
      tx,
      input.pelangganId,
      appendLifecycleNote(
        pelanggan.catatan,
        input.payload.reason,
        input.payload.suspensionType,
      ),
    );

    return suspension;
  });

/** Persist customer activation transaction. */
export const persistCustomerActivation = (
  pelanggan: LifecycleCustomer,
  input: { pelangganId: string; userId: string; payload: ActivatePayload },
) =>
  prisma.$transaction(async (tx) => {
    const activeSuspension = await tx.serviceSuspension.findFirst({
      where: { pelangganId: input.pelangganId, is_active: true },
      orderBy: { suspended_at: "desc" },
    });

    if (!activeSuspension) {
      throw new Error("No active suspension found for this customer");
    }

    const updatedSuspension = await tx.serviceSuspension.update({
      where: { id: activeSuspension.id },
      data: {
        actual_resume_at: new Date(),
        resumed_by: input.userId,
        is_active: false,
        notes: appendActivationNotes(
          activeSuspension.notes,
          input.payload.notes,
        ),
      },
    });

    await updateCustomerStatus(tx, input.pelangganId, Status.AKTIF);
    await updateCustomerNote(
      tx,
      input.pelangganId,
      appendActivationNote(pelanggan.catatan, input.payload),
    );

    return updatedSuspension;
  });

/** Sync suspension status into RADIUS without throwing route error. */
export const syncSuspensionRadius = async (
  radiusService: Pick<
    RadiusSyncService,
    "handleStatusChange" | "getCustomerActiveSessions"
  >,
  pelanggan: { id: string; username: string; tenantId: string | null },
  terminateActiveSessions: boolean,
) => {
  try {
    await radiusService.handleStatusChange(pelanggan.id, Status.NONAKTIF);
    if (!terminateActiveSessions || !pelanggan.tenantId) return;
    await radiusService.getCustomerActiveSessions(
      pelanggan.username,
      pelanggan.tenantId,
    );
  } catch (error) {
    logger.error("Error handling RADIUS operations during suspension:", error);
  }
};

/** Sync activation status into RADIUS without throwing route error. */
export const syncActivationRadius = async (
  radiusService: Pick<RadiusSyncService, "handleStatusChange">,
  pelangganId: string,
  syncToRadius: boolean,
) => {
  if (!syncToRadius) return;

  try {
    await radiusService.handleStatusChange(pelangganId, Status.AKTIF);
  } catch (error) {
    logger.error("Error handling RADIUS operations during activation:", error);
  }
};

/** Build suspend response and publish lifecycle side effects. */
export const finalizeSuspension = async (input: {
  pelangganId: string;
  userId: string;
  payload: SuspendPayload;
  suspensionId: string;
}) => {
  const updatedPelanggan = await getLifecycleCustomerResponse(
    input.pelangganId,
  );
  publishSuspensionLog(
    input.userId,
    input.pelangganId,
    input.suspensionId,
    input.payload,
  );
  publishSuspensionEvent(input.pelangganId, updatedPelanggan?.nama || "");
  return formatSuspendResponse(
    { id: input.suspensionId } as never,
    updatedPelanggan,
  );
};

/** Build activation response and publish lifecycle side effects. */
export const finalizeActivation = async (input: {
  pelangganId: string;
  userId: string;
  payload: ActivatePayload;
  suspensionId: string;
}) => {
  const updatedPelanggan = await getLifecycleCustomerResponse(
    input.pelangganId,
  );
  publishActivationLog(
    input.userId,
    input.pelangganId,
    input.suspensionId,
    input.payload.activationMethod,
  );
  publishActivationEvent(input.pelangganId, updatedPelanggan?.nama || "");
  return formatActivateResponse(
    { id: input.suspensionId } as never,
    updatedPelanggan,
  );
};
