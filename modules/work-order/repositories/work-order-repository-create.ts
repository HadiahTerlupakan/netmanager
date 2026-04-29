import { randomUUID } from "crypto";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import type { CreateWorkOrderData } from "./IWorkOrderRepository";

const MAX_CREATE_RETRIES = 3;
const RETRY_DELAY_MS = 50;
const DATE_SLICE_END = 10;
const WORK_ORDER_SEQUENCE_LENGTH = 4;
const WORK_ORDER_PART_INDEX = 2;

interface PrismaWorkOrderClient {
  workOrders: {
    findFirst(args: object): Promise<{ workOrderNumber: string } | null>;
    create(args: object): Promise<unknown>;
  };
}

/** Buat nomor work order berikutnya berdasarkan tenant dan tanggal hari ini. */
export async function generateNextWorkOrderNumber(
  prisma: PrismaWorkOrderClient,
  tenantId?: string,
): Promise<string> {
  const dateStr = buildWorkOrderDateString();
  const effectiveTenantId =
    tenantId ?? (await getTenantIdFromContext()).tenantId;
  const lastWorkOrder = await prisma.workOrders.findFirst({
    where: {
      tenantId: effectiveTenantId,
      workOrderNumber: { startsWith: `WO-${dateStr}-` },
    },
    orderBy: { workOrderNumber: "desc" },
    select: { workOrderNumber: true },
  });
  const nextSequence = resolveNextSequence(lastWorkOrder?.workOrderNumber);
  return `WO-${dateStr}-${nextSequence.toString().padStart(WORK_ORDER_SEQUENCE_LENGTH, "0")}`;
}

/** Buat work order reguler dengan retry saat nomor work order bentrok. */
export async function createWorkOrderRecord(
  prisma: PrismaWorkOrderClient,
  data: CreateWorkOrderData,
): Promise<unknown> {
  return executeCreateWithRetry(prisma, data, "PENDING", false);
}

/** Buat work order request mobile dengan retry saat nomor work order bentrok. */
export async function createWorkOrderRequestRecord(
  prisma: PrismaWorkOrderClient,
  data: CreateWorkOrderData & { requestedById: string },
): Promise<unknown> {
  return executeCreateWithRetry(prisma, data, "REQUESTED", true);
}

async function executeCreateWithRetry(
  prisma: PrismaWorkOrderClient,
  data: CreateWorkOrderData & { requestedById?: string },
  status: "PENDING" | "REQUESTED",
  isRequest: boolean,
): Promise<unknown> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_CREATE_RETRIES; attempt += 1) {
    try {
      return await createWorkOrderByMode(prisma, data, status, isRequest);
    } catch (error) {
      if (!isDuplicateNumberError(error)) {
        throw error;
      }
      lastError = toError(error);
      logRetryAttempt(attempt, isRequest);
      await waitBeforeRetry(attempt);
    }
  }
  throw buildCreateFailure(lastError, isRequest);
}

async function createWorkOrderByMode(
  prisma: PrismaWorkOrderClient,
  data: CreateWorkOrderData & { requestedById?: string },
  status: "PENDING" | "REQUESTED",
  isRequest: boolean,
): Promise<unknown> {
  const persistedTenantId = await resolvePersistedTenantId(data.tenantId);
  const workOrderNumber = await generateNextWorkOrderNumber(
    prisma,
    persistedTenantId ?? undefined,
  );
  const payload = isRequest
    ? buildRequestCreatePayload(data, persistedTenantId, workOrderNumber)
    : buildDefaultCreatePayload(data, persistedTenantId, workOrderNumber);
  return prisma.workOrders.create({ data: payload });
}

function buildDefaultCreatePayload(
  data: CreateWorkOrderData,
  tenantId: string | null,
  workOrderNumber: string,
): Prisma.WorkOrdersCreateInput {
  const { pelangganId, ...restData } = data;
  return {
    id: randomUUID(),
    updatedAt: new Date(),
    workOrderNumber,
    tenantId,
    type: restData.type,
    title: restData.title,
    description: restData.description,
    status: "PENDING",
    priority: data.priority || "NORMAL",
    createdById: data.createdById ?? null,
    pelangganId: pelangganId || null,
    siteId: restData.siteId || null,
    departmentId: restData.departmentId || null,
    assignedToId: restData.assignedToId || null,
    contactName: restData.contactName ?? null,
    contactPhone: restData.contactPhone ?? null,
    locationAddress: restData.locationAddress ?? null,
    scheduledDate: restData.scheduledDate ?? null,
    scheduledTimeStart: restData.scheduledTimeStart ?? null,
    scheduledTimeEnd: restData.scheduledTimeEnd ?? null,
    estimatedHours: restData.estimatedHours ?? null,
    estimatedCost: restData.estimatedCost ?? null,
    requiredMaterials: restData.requiredMaterials as Prisma.InputJsonValue,
    internalNotes: restData.internalNotes ?? null,
    disconnectionReason: restData.disconnectionReason || null,
    isInternal: restData.isInternal || false,
  } as Prisma.WorkOrdersCreateInput;
}

function buildRequestCreatePayload(
  data: CreateWorkOrderData & { requestedById?: string },
  tenantId: string | null,
  workOrderNumber: string,
): Prisma.WorkOrdersCreateInput {
  const { pelangganId, requestedById, ...restData } = data;
  return {
    id: randomUUID(),
    updatedAt: new Date(),
    workOrderNumber,
    tenantId,
    type: restData.type,
    title: restData.title,
    description: restData.description,
    status: "REQUESTED",
    priority: data.priority || "NORMAL",
    createdById: requestedById ?? null,
    requestedById: requestedById ?? null,
    requestedAt: new Date(),
    pelangganId: pelangganId || null,
    siteId: restData.siteId || null,
    departmentId: restData.departmentId || null,
    assignedToId: null,
    contactName: restData.contactName ?? null,
    contactPhone: restData.contactPhone ?? null,
    locationAddress: restData.locationAddress ?? null,
    locationLat: restData.locationLat ?? null,
    locationLng: restData.locationLng ?? null,
    scheduledDate: restData.scheduledDate ?? null,
    internalNotes: restData.internalNotes ?? null,
    isInternal: restData.isInternal || false,
  } as Prisma.WorkOrdersCreateInput;
}

function buildWorkOrderDateString(): string {
  return new Date().toISOString().slice(0, DATE_SLICE_END).replace(/-/g, "");
}

function resolveNextSequence(workOrderNumber?: string): number {
  if (!workOrderNumber) {
    return 1;
  }
  const parts = workOrderNumber.split("-");
  if (parts.length < WORK_ORDER_PART_INDEX + 1) {
    return 1;
  }
  const parsedSequence = Number.parseInt(
    parts[WORK_ORDER_PART_INDEX] || "0",
    10,
  );
  return Number.isNaN(parsedSequence) ? 1 : parsedSequence + 1;
}

async function resolvePersistedTenantId(
  tenantId?: string,
): Promise<string | null> {
  if (tenantId !== undefined) {
    return tenantId;
  }
  return (await getTenantIdFromContext()).tenantId ?? null;
}

function isDuplicateNumberError(error: unknown): boolean {
  const prismaError = error as { code?: string; meta?: { target?: string[] } };
  return Boolean(
    prismaError?.code === "P2002" &&
    prismaError?.meta?.target?.includes("workOrderNumber"),
  );
}

function logRetryAttempt(attempt: number, isRequest: boolean): void {
  const recordType = isRequest ? "request" : "work order";
  logger.warn(
    `[WorkOrderRepo] Unique constraint violation on workOrderNumber for ${recordType}, retry attempt ${attempt + 1}/${MAX_CREATE_RETRIES}`,
  );
}

function waitBeforeRetry(attempt: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, attempt));
  });
}

function buildCreateFailure(
  lastError: Error | null,
  isRequest: boolean,
): Error {
  const message = isRequest
    ? "Failed to create work order request after max retries"
    : "Failed to create work order after max retries";
  logger.error(`[WorkOrderRepo] ${message}`);
  return lastError || new Error(message);
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
