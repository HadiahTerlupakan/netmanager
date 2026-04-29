import { logger } from "@/lib/logger";
import { prisma } from "@/modules/database";
import { RadiusSyncService } from "@/modules/network";
import { getPelangganService } from "./PelangganService";
import { Prisma, Status } from "@prisma/client";
import * as z from "zod";
import {
  DEFAULT_PAGE,
  MAX_LIMIT,
  appendActivationNote,
  appendActivationNotes,
  appendLifecycleNote,
  buildSuspensionHistoryResponse,
  buildSuspensionWhere,
  buildUsageHistoryResponse,
  buildUsageSummaryResponse,
  createCandidateId,
  createDatabaseUsageAccumulator,
  createFallbackId,
  ensureTenantId,
  formatActivateResponse,
  formatSuspendResponse,
  mapDatabaseHistoryItem,
  mapRadiusHistoryItem,
  mapSuspensionSortBy,
  mapUsageSortBy,
  normalizePagination,
  parseDateRange,
  parseUsagePeriod,
  publishActivationEvent,
  publishActivationLog,
  publishSuspensionEvent,
  publishSuspensionLog,
  sortUsageHistory,
  type ParsedDateRange,
  type SuspensionHistoryInput,
  type UsageCustomerRecord,
  type UsageHistoryInput,
  type UsageSummaryInput,
  type UsageSource,
  type UsageSortBy,
  type SortOrder,
} from "./pelanggan-ppp-route-helpers";
const DEFAULT_CREATE_LIMIT = 10;
const BASIC_CUSTOMER_SELECT = {
  id: true,
  idPelanggan: true,
  nama: true,
  username: true,
  status: true,
  tenantId: true,
  catatan: true,
} as const;
const suspendRequestSchema = z.object({
  suspensionType: z.enum(["PAYMENT", "VIOLATION", "MAINTENANCE", "REQUEST"]),
  reason: z.string().min(1, "Reason is required").max(500, "Reason too long"),
  notes: z.string().max(1000, "Notes too long").optional(),
  expectedResumeAt: z.iso.datetime().optional(),
  terminateActiveSessions: z.boolean().default(true),
});
const activateRequestSchema = z.object({
  notes: z.string().max(1000, "Notes too long").optional(),
  activationMethod: z
    .enum(["MANUAL", "AUTOMATIC", "PAYMENT_CONFIRMED"])
    .optional(),
  syncToRadius: z.boolean().default(true),
});
export class PelangganPppRouteService {
  private readonly radiusService = new RadiusSyncService();
  /** Check whether a pelanggan code already exists. */
  async checkIdExists(idPelanggan: string) {
    try {
      const pelanggan = await prisma.pelanggan.findFirst({
        where: { idPelanggan },
        select: { id: true },
      });
      return { exists: pelanggan !== null };
    } catch {
      return { exists: false };
    }
  }
  /** Generate a unique pelanggan code. */
  async generateUniqueId() {
    let idPelanggan = createCandidateId();
    let attempts = 0;
    while (attempts < DEFAULT_CREATE_LIMIT) {
      const { exists } = await this.checkIdExists(idPelanggan);
      if (!exists) return { idPelanggan };
      idPelanggan = createCandidateId();
      attempts += 1;
    }
    return { idPelanggan: createFallbackId() };
  }
  /** Get one customer usage summary for admin route. */
  async getUsageSummary(input: UsageSummaryInput) {
    const pelanggan = await this.findUsageCustomer(input);
    if (!pelanggan) return null;
    const tenantId = ensureRouteTenantId(pelanggan.tenantId);
    const periodRange = parseRouteUsagePeriod(input);
    const radiusStats = await this.radiusService.getCustomerAccountingStats(
      pelanggan.username,
      tenantId,
      periodRange.startDate,
      periodRange.endDate,
    );
    const activeSession = await this.getFirstActiveSession(pelanggan);
    const dbStats = await this.getDatabaseUsageStats({
      pelangganId: pelanggan.id,
      startDate: periodRange.startDate,
      endDate: periodRange.endDate,
    });
    return buildUsageSummaryResponse({
      pelanggan,
      periodType: input.period,
      periodRange,
      radiusStats,
      activeSession,
      dbStats,
    });
  }
  /** Get combined customer usage history for admin route. */
  async getUsageHistory(input: UsageHistoryInput) {
    const pelanggan = await this.findUsageCustomer(input);
    if (!pelanggan) return null;
    const tenantId = ensureRouteTenantId(pelanggan.tenantId);
    const pagination = normalizeRoutePagination(input.page, input.limit);
    const dateRange = parseRouteDateRange(input.startDate, input.endDate);
    const radiusData = await this.getRadiusHistory(
      { ...pelanggan, tenantId },
      input.source,
      dateRange,
    );
    const databaseData = await this.getDatabaseHistory({
      pelangganId: pelanggan.id,
      source: input.source,
      sortBy: input.sortBy,
      sortOrder: input.sortOrder,
      dateRange,
    });
    const combinedData = sortUsageHistory(
      [...radiusData, ...databaseData],
      input.sortBy,
      input.sortOrder,
    );
    return buildUsageHistoryResponse({
      pelanggan,
      pagination,
      source: input.source,
      dateRange,
      combinedData,
    });
  }
  /** Get customer suspension history and summary. */
  async getSuspensionHistory(input: SuspensionHistoryInput) {
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: input.id },
      select: BASIC_CUSTOMER_SELECT,
    });
    if (!pelanggan) return null;
    const pagination = normalizeRoutePagination(input.page, input.limit);
    const dateRange = parseRouteDateRange(input.startDate, input.endDate);
    const where = buildSuspensionWhere({ ...input, dateRange });
    const [total, suspensions, allSuspensions, activeSuspensions] =
      await Promise.all([
        prisma.serviceSuspension.count({ where }),
        prisma.serviceSuspension.findMany({
          where,
          orderBy: { [mapSuspensionSortBy(input.sortBy)]: input.sortOrder },
          skip: (pagination.page - 1) * pagination.limit,
          take: pagination.limit,
        }),
        prisma.serviceSuspension.findMany({ where: { pelangganId: input.id } }),
        prisma.serviceSuspension.count({
          where: { pelangganId: input.id, is_active: true },
        }),
      ]);
    return buildSuspensionHistoryResponse({
      pelanggan,
      pagination,
      total,
      suspensions,
      allSuspensions,
      activeSuspensions,
      request: input,
      dateRange,
    });
  }
  /** Suspend one customer service and sync radius state. */
  async suspendCustomer(input: SuspendCustomerInput) {
    const payload = suspendRequestSchema.parse(input.body);
    const pelanggan = await this.findPelangganForLifecycle(input.id);
    if (!pelanggan) throw new RouteServiceError("Customer not found", 404);
    if (pelanggan.status === "NONAKTIF") {
      throw new RouteServiceError("Customer is already suspended", 400);
    }
    const result = await prisma.$transaction(async (tx) => {
      const suspensionData =
        Prisma.validator<Prisma.ServiceSuspensionUncheckedCreateInput>()({
          id: crypto.randomUUID(),
          pelangganId: input.id,
          suspension_type: payload.suspensionType,
          reason: payload.reason,
          notes: payload.notes,
          expected_resume_at: payload.expectedResumeAt
            ? new Date(payload.expectedResumeAt)
            : null,
          suspended_by: input.userId,
          is_active: true,
          tenantId: pelanggan.tenantId,
          updated_at: new Date(),
        });
      const suspension = await tx.serviceSuspension.create({
        data: suspensionData,
      });
      await tx.pelanggan.update({
        where: { id: input.id },
        data: { status: "NONAKTIF", updatedAt: new Date() },
      });
      await tx.pelanggan.update({
        where: { id: input.id },
        data: {
          catatan: appendLifecycleNote(
            pelanggan.catatan,
            payload.reason,
            payload.suspensionType,
          ),
        },
      });
      return suspension;
    });
    await this.syncSuspensionRadius(pelanggan, payload.terminateActiveSessions);
    const updatedPelanggan = await this.getLifecycleCustomerResponse(input.id);
    publishSuspensionLog(input.userId, input.id, result.id, payload);
    publishSuspensionEvent(input.id, updatedPelanggan?.nama || "");
    return formatSuspendResponse(result, updatedPelanggan);
  }
  /** Update one customer status and return audit context. */
  async updateCustomerStatus(input: UpdateCustomerStatusInput) {
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: input.id },
    });
    if (!pelanggan) throw new RouteServiceError("Pelanggan not found", 404);
    const updatedPelanggan = await getPelangganService().updateStatusPelanggan(
      input.id,
      input.status,
    );
    return {
      pelanggan,
      updatedPelanggan,
      message: `Status updated to ${input.status}`,
    };
  }
  /** Activate one suspended customer service and sync radius state. */
  async activateCustomer(input: ActivateCustomerInput) {
    const payload = activateRequestSchema.parse(input.body);
    const pelanggan = await this.findPelangganForLifecycle(input.id);
    if (!pelanggan) throw new RouteServiceError("Customer not found", 404);
    if (pelanggan.status !== "NONAKTIF") {
      throw new RouteServiceError("Customer is not currently suspended", 400);
    }
    const result = await prisma.$transaction(async (tx) => {
      const activeSuspension = await tx.serviceSuspension.findFirst({
        where: { pelangganId: input.id, is_active: true },
        orderBy: { suspended_at: "desc" },
      });
      if (!activeSuspension) {
        throw new RouteServiceError(
          "No active suspension found for this customer",
          400,
        );
      }
      const updatedSuspension = await tx.serviceSuspension.update({
        where: { id: activeSuspension.id },
        data: {
          actual_resume_at: new Date(),
          resumed_by: input.userId,
          is_active: false,
          notes: appendActivationNotes(activeSuspension.notes, payload.notes),
        },
      });
      await tx.pelanggan.update({
        where: { id: input.id },
        data: { status: "AKTIF", updatedAt: new Date() },
      });
      await tx.pelanggan.update({
        where: { id: input.id },
        data: { catatan: appendActivationNote(pelanggan.catatan, payload) },
      });
      return updatedSuspension;
    });
    await this.syncActivationRadius(input.id, payload.syncToRadius);
    const updatedPelanggan = await this.getLifecycleCustomerResponse(input.id);
    publishActivationLog(
      input.userId,
      input.id,
      result.id,
      payload.activationMethod,
    );
    publishActivationEvent(input.id, updatedPelanggan?.nama || "");
    return formatActivateResponse(result, updatedPelanggan);
  }
  private async findUsageCustomer(input: {
    id: string;
    tenantId?: string | null;
  }) {
    return prisma.pelanggan.findFirst({
      where: {
        id: input.id,
        ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      },
      select: BASIC_CUSTOMER_SELECT,
    });
  }
  private async getFirstActiveSession(pelanggan: UsageCustomerRecord) {
    const activeSessions = await this.radiusService.getCustomerActiveSessions(
      pelanggan.username,
      pelanggan.tenantId,
    );
    return activeSessions[0] ?? null;
  }
  private async getDatabaseUsageStats(input: DatabaseUsageStatsInput) {
    const customerUsage = await prisma.customerUsage.findMany({
      where: {
        pelangganId: input.pelangganId,
        session_start_time: {
          gte: input.startDate,
          lte: input.endDate,
        },
      },
      orderBy: { session_start_time: "desc" },
      take: MAX_LIMIT,
    });
    return customerUsage.reduce(
      (acc, usage) => ({
        totalSessionTime:
          acc.totalSessionTime + BigInt(usage.session_duration ?? 0),
        totalUploadBytes:
          acc.totalUploadBytes + BigInt(usage.upload_bytes ?? 0),
        totalDownloadBytes:
          acc.totalDownloadBytes + BigInt(usage.download_bytes ?? 0),
        totalBytes: acc.totalBytes + BigInt(usage.total_bytes ?? 0),
        sessionCount: acc.sessionCount + 1,
      }),
      createDatabaseUsageAccumulator(),
    );
  }
  private async getRadiusHistory(
    pelanggan: UsageCustomerRecord,
    source: UsageSource,
    dateRange: ParsedDateRange,
  ) {
    if (source === "database") return [];
    const radiusSessions = await this.radiusService.getCustomerSessionHistory(
      pelanggan.username,
      pelanggan.tenantId,
      {
        page: DEFAULT_PAGE,
        limit: MAX_LIMIT,
        ...(dateRange.startDate ? { startDate: dateRange.startDate } : {}),
        ...(dateRange.endDate ? { endDate: dateRange.endDate } : {}),
      },
    );
    return radiusSessions.sessions.map(mapRadiusHistoryItem);
  }
  private async getDatabaseHistory(input: DatabaseHistoryInput) {
    if (input.source === "radius") return [];
    const usageRecords = await prisma.customerUsage.findMany({
      where: {
        pelangganId: input.pelangganId,
        ...(input.dateRange.startDate
          ? { session_start_time: { gte: input.dateRange.startDate } }
          : {}),
        ...(input.dateRange.endDate
          ? {
              session_start_time: {
                ...(input.dateRange.startDate
                  ? { gte: input.dateRange.startDate }
                  : {}),
                lte: input.dateRange.endDate,
              },
            }
          : {}),
      },
      orderBy: { [mapUsageSortBy(input.sortBy)]: input.sortOrder },
    });
    return usageRecords.map(mapDatabaseHistoryItem);
  }
  private async findPelangganForLifecycle(id: string) {
    return prisma.pelanggan.findUnique({
      where: { id },
      include: {
        hargaPaket: { include: { bandwidth: true } },
      },
    });
  }
  private async getLifecycleCustomerResponse(id: string) {
    return prisma.pelanggan.findUnique({
      where: { id },
      select: {
        id: true,
        idPelanggan: true,
        nama: true,
        username: true,
        status: true,
      },
    });
  }
  private async syncSuspensionRadius(
    pelanggan: { id: string; username: string; tenantId: string | null },
    terminateActiveSessions: boolean,
  ) {
    try {
      await this.radiusService.handleStatusChange(
        pelanggan.id,
        Status.NONAKTIF,
      );
      if (!terminateActiveSessions || !pelanggan.tenantId) return;
      await this.radiusService.getCustomerActiveSessions(
        pelanggan.username,
        pelanggan.tenantId,
      );
    } catch (error) {
      logger.error(
        "Error handling RADIUS operations during suspension:",
        error,
      );
    }
  }
  private async syncActivationRadius(id: string, syncToRadius: boolean) {
    if (!syncToRadius) return;
    try {
      await this.radiusService.handleStatusChange(id, Status.AKTIF);
    } catch (error) {
      logger.error(
        "Error handling RADIUS operations during activation:",
        error,
      );
    }
  }
}
function normalizeRoutePagination(page: number, limit: number) {
  try {
    return normalizePagination(page, limit);
  } catch (error) {
    throw new RouteServiceError(
      error instanceof Error ? error.message : "Parameter paginasi tidak valid",
      400,
    );
  }
}
function parseRouteUsagePeriod(input: UsageSummaryInput) {
  try {
    return parseUsagePeriod(input);
  } catch (error) {
    throw new RouteServiceError(
      error instanceof Error ? error.message : "Parameter periode tidak valid",
      400,
    );
  }
}
function parseRouteDateRange(
  startDate?: string | null,
  endDate?: string | null,
) {
  try {
    return parseDateRange(startDate, endDate);
  } catch (error) {
    throw new RouteServiceError(
      error instanceof Error ? error.message : "Format tanggal tidak valid",
      400,
    );
  }
}
function ensureRouteTenantId(tenantId: string | null) {
  try {
    return ensureTenantId(tenantId);
  } catch (error) {
    throw new RouteServiceError(
      error instanceof Error ? error.message : "Customer tenant not found",
      400,
    );
  }
}
export class RouteServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "RouteServiceError";
  }
}
type SuspendCustomerInput = {
  id: string;
  userId: string;
  body: unknown;
};
type ActivateCustomerInput = {
  id: string;
  userId: string;
  body: unknown;
};
type UpdateCustomerStatusInput = {
  id: string;
  status: Status;
};
type DatabaseUsageStatsInput = {
  pelangganId: string;
  startDate: Date;
  endDate: Date;
};
type DatabaseHistoryInput = {
  pelangganId: string;
  source: UsageSource;
  sortBy: UsageSortBy;
  sortOrder: SortOrder;
  dateRange: ParsedDateRange;
};
