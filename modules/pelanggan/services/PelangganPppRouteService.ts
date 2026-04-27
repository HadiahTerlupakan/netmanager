import { prisma } from "@/modules/database";
import { RadiusSyncService } from "@/modules/network";
import { getPelangganService } from "./PelangganService";
import { CustomerEventDispatcher } from "@/modules/events";
import { logActivitySafe } from "@/lib/logger";
import { toEndOfDay } from "@/lib/utils/server-datetime";
import { Prisma, Status } from "@prisma/client";
import * as z from "zod";

const DEFAULT_PAGE = 1;
const MAX_LIMIT = 100;
const DEFAULT_CREATE_LIMIT = 10;
const BYTES_PER_GB = 1073741824;
const SECONDS_PER_HOUR = 3600;
const MILLISECONDS_PER_HOUR = 1000 * 60 * 60;
const LAST_SEVEN_DAYS = 7;
const LAST_THIRTY_DAYS = 30;
const DATE_END_HOUR = 23;
const DATE_END_MINUTE = 59;
const DATE_END_SECOND = 59;
const DATE_END_MILLISECOND = 999;
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

    const tenantId = ensureTenantId(pelanggan.tenantId);
    const periodRange = parseUsagePeriod(input);
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

    const tenantId = ensureTenantId(pelanggan.tenantId);
    const pagination = normalizePagination(input.page, input.limit);
    const dateRange = parseDateRange(input.startDate, input.endDate);
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

    const pagination = normalizePagination(input.page, input.limit);
    const dateRange = parseDateRange(input.startDate, input.endDate);
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
      input,
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
      console.error(
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
      console.error(
        "Error handling RADIUS operations during activation:",
        error,
      );
    }
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

type UsageSource = "all" | "radius" | "database";
type UsageSortBy = "sessionStartTime" | "sessionDuration" | "totalBytes";
type SortOrder = "asc" | "desc";
type SuspensionSortBy = "suspendedAt" | "actualResumeAt" | "suspendedBy";
type PeriodType =
  | "current_month"
  | "last_month"
  | "last_7_days"
  | "last_30_days"
  | "custom";

type UsageSummaryInput = {
  id: string;
  tenantId?: string | null;
  period: PeriodType;
  startDate?: string | null;
  endDate?: string | null;
};

type UsageHistoryInput = {
  id: string;
  tenantId?: string | null;
  page: number;
  limit: number;
  startDate?: string | null;
  endDate?: string | null;
  source: UsageSource;
  sortBy: UsageSortBy;
  sortOrder: SortOrder;
};

type SuspensionHistoryInput = {
  id: string;
  page: number;
  limit: number;
  suspensionType?: string | null;
  status: "active" | "inactive" | "all";
  startDate?: string | null;
  endDate?: string | null;
  sortBy: SuspensionSortBy;
  sortOrder: SortOrder;
};

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

type UsageCustomerRecord = {
  id: string;
  idPelanggan: string;
  nama: string;
  username: string;
  status: string;
  tenantId: string | null;
  catatan: string | null;
};

type ParsedDateRange = {
  startDate?: Date;
  endDate?: Date;
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

function createCandidateId() {
  const timestampPart = String(Date.now()).slice(-5);
  const random = Math.floor(Math.random() * 1000);
  return timestampPart + String(random).padStart(3, "0");
}

function createFallbackId() {
  const timestampPart = String(Date.now()).slice(-6);
  const random = Math.floor(Math.random() * 10000);
  return timestampPart + String(random).padStart(2, "0");
}

function normalizePagination(page: number, limit: number) {
  if (page < DEFAULT_PAGE || limit < DEFAULT_PAGE || limit > MAX_LIMIT) {
    throw new RouteServiceError("Parameter paginasi tidak valid", 400);
  }

  return { page, limit };
}

function parseUsagePeriod(input: UsageSummaryInput) {
  const now = new Date();
  if (input.period === "current_month") {
    return createMonthRange(now.getFullYear(), now.getMonth());
  }
  if (input.period === "last_month") {
    return createMonthRange(now.getFullYear(), now.getMonth() - 1);
  }
  if (input.period === "last_7_days") {
    return createRelativeRange(now, LAST_SEVEN_DAYS);
  }
  if (input.period === "last_30_days") {
    return createRelativeRange(now, LAST_THIRTY_DAYS);
  }
  if (input.period !== "custom") {
    throw new RouteServiceError("Parameter periode tidak valid", 400);
  }

  return parseCustomPeriod(input.startDate, input.endDate);
}

function createMonthRange(year: number, month: number) {
  return {
    startDate: new Date(year, month, 1),
    endDate: new Date(
      year,
      month + 1,
      0,
      DATE_END_HOUR,
      DATE_END_MINUTE,
      DATE_END_SECOND,
      DATE_END_MILLISECOND,
    ),
  };
}

function createRelativeRange(now: Date, dayCount: number) {
  return {
    startDate: new Date(now.getTime() - dayCount * 24 * 60 * 60 * 1000),
    endDate: now,
  };
}

function parseCustomPeriod(startDate?: string | null, endDate?: string | null) {
  if (!startDate || !endDate) {
    throw new RouteServiceError(
      "Custom period requires startDate and endDate parameters",
      400,
    );
  }

  const parsedStartDate = new Date(startDate);
  const parsedEndDate = new Date(endDate);
  if (
    Number.isNaN(parsedStartDate.getTime()) ||
    Number.isNaN(parsedEndDate.getTime())
  ) {
    throw new RouteServiceError(
      "Format tanggal tidak valid. Gunakan format YYYY-MM-DD",
      400,
    );
  }

  return { startDate: parsedStartDate, endDate: parsedEndDate };
}

function parseDateRange(startDate?: string | null, endDate?: string | null) {
  const parsedStartDate = parseDateValue(startDate, "startDate");
  const parsedEndDate = parseDateValue(endDate, "endDate", true);
  return { startDate: parsedStartDate, endDate: parsedEndDate };
}

function parseDateValue(
  value?: string | null,
  label = "date",
  endOfDay = false,
) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RouteServiceError(
      `Format ${label} tidak valid. Gunakan format YYYY-MM-DD`,
      400,
    );
  }

  return endOfDay ? new Date(toEndOfDay(date).getTime()) : date;
}

function ensureTenantId(tenantId: string | null) {
  if (!tenantId) {
    throw new RouteServiceError("Customer tenant not found", 400);
  }

  return tenantId;
}

function createDatabaseUsageAccumulator() {
  return {
    totalSessionTime: BigInt(0),
    totalUploadBytes: BigInt(0),
    totalDownloadBytes: BigInt(0),
    totalBytes: BigInt(0),
    sessionCount: 0,
  };
}

function buildUsageSummaryResponse(input: {
  pelanggan: UsageCustomerRecord;
  periodType: PeriodType;
  periodRange: { startDate: Date; endDate: Date };
  radiusStats: Awaited<
    ReturnType<RadiusSyncService["getCustomerAccountingStats"]>
  >;
  activeSession:
    | Awaited<
        ReturnType<RadiusSyncService["getCustomerActiveSessions"]>
      >[number]
    | null;
  dbStats: ReturnType<typeof createDatabaseUsageAccumulator>;
}) {
  const totalInput = Number(input.radiusStats.totalInputOctets);
  const totalOutput = Number(input.radiusStats.totalOutputOctets);

  return {
    success: true,
    customer: buildUsageCustomer(input.pelanggan),
    period: {
      type: input.periodType,
      startDate: input.periodRange.startDate.toISOString(),
      endDate: input.periodRange.endDate.toISOString(),
    },
    usage: {
      totalSessions: input.radiusStats.totalSessions,
      totalSessionTime: input.radiusStats.totalSessionTime.toString(),
      totalInputOctets: input.radiusStats.totalInputOctets.toString(),
      totalOutputOctets: input.radiusStats.totalOutputOctets.toString(),
      activeSessions: input.radiusStats.activeSessions,
      dbSessionCount: input.dbStats.sessionCount,
      dbTotalSessionTime: input.dbStats.totalSessionTime.toString(),
      dbTotalUploadBytes: input.dbStats.totalUploadBytes.toString(),
      dbTotalDownloadBytes: input.dbStats.totalDownloadBytes.toString(),
      dbTotalBytes: input.dbStats.totalBytes.toString(),
      totalSessionTimeHours: toHours(input.radiusStats.totalSessionTime),
      totalInputGB: totalInput / BYTES_PER_GB,
      totalOutputGB: totalOutput / BYTES_PER_GB,
      totalGB: (totalInput + totalOutput) / BYTES_PER_GB,
      dbTotalSessionTimeHours: toHours(input.dbStats.totalSessionTime),
      dbTotalUploadGB: Number(input.dbStats.totalUploadBytes) / BYTES_PER_GB,
      dbTotalDownloadGB:
        Number(input.dbStats.totalDownloadBytes) / BYTES_PER_GB,
      dbTotalGB: Number(input.dbStats.totalBytes) / BYTES_PER_GB,
    },
    activeSession: input.activeSession
      ? {
          sessionId: input.activeSession.acctSessionId,
          startTime: input.activeSession.acctStartTime?.toISOString(),
          nasIpAddress: input.activeSession.nasIpAddress,
        }
      : null,
  };
}

function buildUsageCustomer(pelanggan: UsageCustomerRecord) {
  return {
    id: pelanggan.id,
    idPelanggan: pelanggan.idPelanggan,
    nama: pelanggan.nama,
    username: pelanggan.username,
    status: pelanggan.status,
  };
}

function toHours(value: bigint) {
  return Number(value) / SECONDS_PER_HOUR;
}

function mapUsageSortBy(sortBy: UsageSortBy) {
  if (sortBy === "sessionDuration") return "session_duration";
  if (sortBy === "totalBytes") return "total_bytes";
  return "session_start_time";
}

function mapRadiusHistoryItem(item: {
  radAcctId: string;
  acctSessionId?: string | null;
  acctStartTime: string | null;
  acctStopTime: string | null;
  acctSessionTime: string;
  acctInputOctets: string;
  acctOutputOctets: string;
  totalOctets: string;
  nasIpAddress?: string | null;
  framedIpAddress?: string | null;
}): {
  id: string;
  sessionId: string | null;
  sessionStartTime: string | null;
  sessionEndTime: string | null;
  sessionDuration: string;
  sessionDurationMinutes: number;
  uploadBytes: string;
  downloadBytes: string;
  totalBytes: string;
  uploadGB: number;
  downloadGB: number;
  totalGB: number;
  nasIpAddress: string | null;
  callingStationId: string | null;
  calledStationId: string | null;
  terminateCause: string | null;
  source: "radius";
} {
  return {
    id: `radius-${item.radAcctId}`,
    sessionId: item.acctSessionId ?? null,
    sessionStartTime: item.acctStartTime,
    sessionEndTime: item.acctStopTime,
    sessionDuration: item.acctSessionTime,
    sessionDurationMinutes: Number(item.acctSessionTime) / 60,
    uploadBytes: item.acctInputOctets,
    downloadBytes: item.acctOutputOctets,
    totalBytes: item.totalOctets,
    uploadGB: Number(item.acctInputOctets) / BYTES_PER_GB,
    downloadGB: Number(item.acctOutputOctets) / BYTES_PER_GB,
    totalGB: Number(item.totalOctets) / BYTES_PER_GB,
    nasIpAddress: item.nasIpAddress ?? null,
    callingStationId: null,
    calledStationId: null,
    terminateCause: null,
    source: "radius" as const,
  };
}

function mapDatabaseHistoryItem(usage: {
  id: string;
  session_id: string | null;
  session_start_time: Date;
  session_end_time: Date | null;
  session_duration: bigint | null;
  upload_bytes: bigint | null;
  download_bytes: bigint | null;
  total_bytes: bigint | null;
  nas_ip_address: string | null;
  calling_station_id: string | null;
  called_station_id: string | null;
  terminate_cause: string | null;
}) {
  const totalBytes = BigInt(usage.total_bytes ?? 0);
  return {
    id: usage.id,
    sessionId: usage.session_id,
    sessionStartTime: usage.session_start_time,
    sessionEndTime: usage.session_end_time,
    sessionDuration: String(usage.session_duration ?? 0),
    sessionDurationMinutes: Number(usage.session_duration ?? 0) / 60,
    uploadBytes: String(usage.upload_bytes ?? 0),
    downloadBytes: String(usage.download_bytes ?? 0),
    totalBytes: String(usage.total_bytes ?? 0),
    uploadGB: Number(usage.upload_bytes ?? 0) / BYTES_PER_GB,
    downloadGB: Number(usage.download_bytes ?? 0) / BYTES_PER_GB,
    totalGB: Number(totalBytes) / BYTES_PER_GB,
    nasIpAddress: usage.nas_ip_address,
    callingStationId: usage.calling_station_id,
    calledStationId: usage.called_station_id,
    terminateCause: usage.terminate_cause,
    source: "database" as const,
  };
}

function sortUsageHistory(
  combinedData: CombinedUsageItem[],
  sortBy: UsageSortBy,
  sortOrder: SortOrder,
) {
  return combinedData.sort((left, right) => {
    const leftValue = normalizeSortValue(left[sortBy]);
    const rightValue = normalizeSortValue(right[sortBy]);
    if (sortOrder === "asc") return leftValue > rightValue ? 1 : -1;
    return leftValue < rightValue ? 1 : -1;
  });
}

function normalizeSortValue(value: unknown) {
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
    return new Date(value).getTime();
  }
  if (value instanceof Date) return value.getTime();
  return value ?? 0;
}

function buildUsageHistoryResponse(input: {
  pelanggan: UsageCustomerRecord;
  pagination: { page: number; limit: number };
  source: UsageSource;
  dateRange: ParsedDateRange;
  combinedData: CombinedUsageItem[];
}) {
  const total = input.combinedData.length;
  const totalPages = Math.ceil(total / input.pagination.limit);
  const startIndex = (input.pagination.page - 1) * input.pagination.limit;

  return {
    success: true,
    customer: buildUsageCustomer(input.pelanggan),
    pagination: {
      page: input.pagination.page,
      limit: input.pagination.limit,
      total,
      totalPages,
    },
    filters: {
      startDate: input.dateRange.startDate?.toISOString() || null,
      endDate: input.dateRange.endDate?.toISOString() || null,
      source: input.source,
    },
    data: input.combinedData.slice(
      startIndex,
      startIndex + input.pagination.limit,
    ),
  };
}

function buildSuspensionWhere(input: {
  id: string;
  suspensionType?: string | null;
  status: "active" | "inactive" | "all";
  dateRange: ParsedDateRange;
}) {
  return {
    pelangganId: input.id,
    ...(input.suspensionType ? { suspension_type: input.suspensionType } : {}),
    ...(input.dateRange.startDate
      ? { suspended_at: { gte: input.dateRange.startDate } }
      : {}),
    ...(input.dateRange.endDate
      ? {
          suspended_at: {
            ...(input.dateRange.startDate
              ? { gte: input.dateRange.startDate }
              : {}),
            lte: input.dateRange.endDate,
          },
        }
      : {}),
    ...(input.status === "active"
      ? { is_active: true }
      : input.status === "inactive"
        ? { is_active: false }
        : {}),
  };
}

function mapSuspensionSortBy(sortBy: SuspensionSortBy) {
  if (sortBy === "actualResumeAt") return "actual_resume_at";
  if (sortBy === "suspendedBy") return "suspended_at";
  return "suspended_at";
}

function buildSuspensionHistoryResponse(input: {
  pelanggan: UsageCustomerRecord;
  pagination: { page: number; limit: number };
  total: number;
  suspensions: Array<{
    id: string;
    suspension_type: string;
    reason: string;
    suspended_at: Date;
    suspended_by: string | null;
    expected_resume_at: Date | null;
    actual_resume_at: Date | null;
    resumed_by: string | null;
    notes: string | null;
    is_active: boolean;
  }>;
  allSuspensions: Array<{
    reason: string;
    suspended_at: Date;
    actual_resume_at: Date | null;
  }>;
  activeSuspensions: number;
  input: SuspensionHistoryInput;
  dateRange: ParsedDateRange;
}) {
  const statistics = calculateSuspensionStatistics(
    input.allSuspensions,
    input.activeSuspensions,
  );

  return {
    success: true,
    customer: buildUsageCustomer(input.pelanggan),
    pagination: {
      page: input.pagination.page,
      limit: input.pagination.limit,
      total: input.total,
      totalPages: Math.ceil(input.total / input.pagination.limit),
    },
    filters: {
      suspensionType: input.input.suspensionType || null,
      status: input.input.status,
      startDate: input.dateRange.startDate?.toISOString() || null,
      endDate: input.dateRange.endDate?.toISOString() || null,
      sortBy: input.input.sortBy,
      sortOrder: input.input.sortOrder,
    },
    statistics,
    data: input.suspensions.map(formatSuspensionItem),
  };
}

function calculateSuspensionStatistics(
  suspensions: Array<{
    reason: string;
    suspended_at: Date;
    actual_resume_at: Date | null;
  }>,
  activeSuspensions: number,
) {
  const completed = suspensions.filter((item) => item.actual_resume_at);
  const totalHours = completed.reduce(
    (total, item) =>
      total +
      (item.actual_resume_at!.getTime() - item.suspended_at.getTime()) /
        MILLISECONDS_PER_HOUR,
    0,
  );
  const averageHours = completed.length > 0 ? totalHours / completed.length : 0;
  const mostCommonReason = calculateMostCommonReason(suspensions);

  return {
    totalSuspensions: suspensions.length,
    activeSuspensions,
    averageSuspensionDuration: Math.round(averageHours * 100) / 100,
    mostCommonReason,
  };
}

function calculateMostCommonReason(
  suspensions: Array<{ reason: string }>,
): string | null {
  const counts = suspensions.reduce<Record<string, number>>((acc, item) => {
    const key = item.reason || "Unknown";
    return { ...acc, [key]: (acc[key] || 0) + 1 };
  }, {});
  const reasons = Object.keys(counts);
  if (reasons.length === 0) return null;
  return reasons.reduce((left, right) =>
    counts[left] > counts[right] ? left : right,
  );
}

function formatSuspensionItem(item: {
  id: string;
  suspension_type: string;
  reason: string;
  suspended_at: Date;
  suspended_by: string | null;
  expected_resume_at: Date | null;
  actual_resume_at: Date | null;
  resumed_by: string | null;
  notes: string | null;
  is_active: boolean;
}) {
  return {
    id: item.id,
    suspensionType: item.suspension_type,
    reason: item.reason,
    suspendedAt: item.suspended_at.toISOString(),
    suspendedBy: item.suspended_by,
    expectedResumeAt: item.expected_resume_at?.toISOString() || null,
    actualResumeAt: item.actual_resume_at?.toISOString() || null,
    resumedBy: item.resumed_by,
    notes: item.notes,
    isActive: item.is_active,
    durationHours: item.actual_resume_at
      ? (item.actual_resume_at.getTime() - item.suspended_at.getTime()) /
        MILLISECONDS_PER_HOUR
      : null,
  };
}

function appendLifecycleNote(
  existingNote: string | null,
  reason: string,
  suspensionType: string,
) {
  const suspensionNote = `Service suspended: ${reason} (${suspensionType})`;
  return existingNote ? `${existingNote}\n\n${suspensionNote}` : suspensionNote;
}

function appendActivationNote(
  existingNote: string | null,
  payload: { activationMethod?: string; notes?: string },
) {
  const activationMethod = payload.activationMethod || "MANUAL";
  const activationNote = `Service reactivated: ${activationMethod}${payload.notes ? ` - ${payload.notes}` : ""}`;
  return existingNote ? `${existingNote}\n\n${activationNote}` : activationNote;
}

function appendActivationNotes(existingNote: string | null, notes?: string) {
  if (!notes) return existingNote;
  return `${existingNote || ""}\n\nActivation: ${notes}`.trim();
}

function publishSuspensionLog(
  userId: string,
  pelangganId: string,
  suspensionId: string,
  payload: { suspensionType: string; reason: string },
) {
  logActivitySafe({
    action: "SUSPEND",
    subject: "Pelanggan",
    userId,
    details: {
      id: pelangganId,
      type: payload.suspensionType,
      reason: payload.reason,
      suspensionId,
    },
  });
}

function publishActivationLog(
  userId: string,
  pelangganId: string,
  suspensionId: string,
  activationMethod?: string,
) {
  logActivitySafe({
    action: "ACTIVATE",
    subject: "Pelanggan",
    userId,
    details: {
      id: pelangganId,
      method: activationMethod || "MANUAL",
      suspensionId,
    },
  });
}

function publishSuspensionEvent(customerId: string, customerName: string) {
  CustomerEventDispatcher.onSuspended({
    customerId,
    customerName,
    oldStatus: "AKTIF",
    newStatus: "NONAKTIF",
  }).catch((error) =>
    console.error("Failed to publish CUSTOMER_SUSPENDED event:", error),
  );
}

function publishActivationEvent(customerId: string, customerName: string) {
  CustomerEventDispatcher.onActivated({
    customerId,
    customerName,
    oldStatus: "NONAKTIF",
    newStatus: "AKTIF",
  }).catch((error) =>
    console.error("Failed to publish CUSTOMER_ACTIVATED event:", error),
  );
}

function formatSuspendResponse(
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
  customer: {
    id: string;
    idPelanggan: string;
    nama: string;
    username: string;
    status: string;
  } | null,
) {
  return {
    success: true,
    message: "Customer service suspended successfully",
    suspension: {
      id: suspension.id,
      suspensionType: suspension.suspension_type,
      reason: suspension.reason,
      notes: suspension.notes,
      suspendedAt: suspension.suspended_at.toISOString(),
      expectedResumeAt: suspension.expected_resume_at?.toISOString() || null,
      suspendedBy: suspension.suspended_by,
      isActive: suspension.is_active,
    },
    customer,
  };
}

function formatActivateResponse(
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
  customer: {
    id: string;
    idPelanggan: string;
    nama: string;
    username: string;
    status: string;
  } | null,
) {
  return {
    success: true,
    message: "Customer service activated successfully",
    suspension: {
      id: suspension.id,
      suspensionType: suspension.suspension_type,
      reason: suspension.reason,
      suspendedAt: suspension.suspended_at.toISOString(),
      actualResumeAt: suspension.actual_resume_at.toISOString(),
      resumedBy: suspension.resumed_by,
      isActive: suspension.is_active,
      notes: suspension.notes,
    },
    customer,
  };
}

type CombinedUsageItem =
  | ReturnType<typeof mapRadiusHistoryItem>
  | ReturnType<typeof mapDatabaseHistoryItem>;
