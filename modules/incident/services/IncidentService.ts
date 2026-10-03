import type { IncidentStatus } from "@prisma/client";

import { createRouteServiceError } from "@/lib/api/route-service-error";
import { logger } from "@/lib/logger";
import { TenantContextError } from "@/lib/prisma-extension";

import {
  getIncidentRepository,
  type CreateIncidentInput,
  type IncidentEntity,
  type IncidentRepository,
  type IncidentUpdateEntity,
  type IncidentWithUpdates,
  type UpdateIncidentStatusInput,
} from "../repositories/IncidentRepository";

export type SeverityLevel = "CRITICAL" | "MAJOR" | "MINOR";

export interface IncidentAnalytics {
  windowDays: number;
  totalIncidents: number;
  totalResolved: number;
  /** Semua insiden yang belum selesai, termasuk yang mulai sebelum jendela analytics. */
  totalActive: number;
  avgResolutionMinutes: number;
  bySeverity: Record<SeverityLevel, number>;
  recentlyResolved: Array<{
    id: string;
    title: string;
    severity: SeverityLevel;
    durationMinutes: number;
    resolvedAt: Date;
  }>;
}

/** Rentang analytics yang diizinkan (hari). */
export const ANALYTICS_WINDOW_DAYS = 30;
export const ANALYTICS_WINDOW_MIN_DAYS = 1;
export const ANALYTICS_WINDOW_MAX_DAYS = 365;

const MS_PER_MENIT = 60 * 1000;
const MS_PER_HARI = 24 * 60 * MS_PER_MENIT;
const JUMLAH_BARU_SELESAI = 10;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const PESAN_TIDAK_DITEMUKAN = "Insiden tidak ditemukan";
const PESAN_DOMAIN_TANPA_TENANT = "Halaman status tidak tersedia di domain ini";
const BATAS_STATUS_AKTIF = 50;
const BATAS_STATUS_SELESAI = 10;
const PESAN_SUDAH_SELESAI =
  "Insiden sudah selesai dan tidak bisa diubah. Buat insiden baru bila gangguan terjadi lagi.";

const durasiMenit = (mulai: Date, selesai: Date) =>
  Math.floor((selesai.getTime() - mulai.getTime()) / MS_PER_MENIT);

/** Publikasi event tidak boleh menggagalkan permintaan yang datanya sudah tersimpan. */
async function publikasikanAman(label: string, kirim: () => Promise<void>) {
  try {
    await kirim();
  } catch (error) {
    logger.error(`[Incident] Gagal publish ${label}:`, error);
  }
}

/** Business logic Manajemen Insiden (gangguan layanan & halaman status publik). */
export class IncidentService {
  constructor(private readonly repo: IncidentRepository = getIncidentRepository()) {}

  /**
   * Daftar insiden. `tenantId` wajib untuk jalur admin; halaman status publik
   * (tanpa sesi) mengosongkannya dan tenant diturunkan dari host.
   */
  async list(filters: {
    tenantId?: string;
    status?: IncidentStatus | "ACTIVE";
    publicOnly?: boolean;
    limit?: number;
  }): Promise<IncidentEntity[]> {
    return this.repo.findMany(filters);
  }

  /**
   * Data halaman status publik (tanpa sesi): insiden publik yang belum selesai dan
   * yang terakhir selesai. Tenant diturunkan dari host; domain yang bukan milik tenant
   * (mis. admin.*, IP) → 404, bukan galat server. Lookup tenant yang gagal tetap dilempar.
   */
  async statusPublik(): Promise<{ active: IncidentEntity[]; recent: IncidentEntity[] }> {
    try {
      const [active, recent] = await Promise.all([
        this.repo.findMany({ status: "ACTIVE", publicOnly: true, limit: BATAS_STATUS_AKTIF }),
        this.repo.findMany({ status: "RESOLVED", publicOnly: true, limit: BATAS_STATUS_SELESAI }),
      ]);
      return { active, recent };
    } catch (error) {
      if (error instanceof TenantContextError && error.kind === "missing-context") {
        throw createRouteServiceError(PESAN_DOMAIN_TANPA_TENANT, HTTP_NOT_FOUND);
      }
      throw error;
    }
  }

  /** Detail insiden beserta riwayat update; 404 bila tidak ada di tenant ini. */
  async getById(tenantId: string, id: string): Promise<IncidentWithUpdates> {
    const incident = await this.repo.findById(tenantId, id);
    if (!incident) throw createRouteServiceError(PESAN_TIDAK_DITEMUKAN, HTTP_NOT_FOUND);
    return incident;
  }

  /** Buat insiden baru (update awal INVESTIGATING ikut dibuat) lalu publish `incident:created`. */
  async create(tenantId: string, input: CreateIncidentInput, createdById: string): Promise<IncidentEntity> {
    const incident = await this.repo.createWithInitialUpdate(tenantId, { ...input, createdById });
    logger.info(
      `[Incident] Created ${incident.id} severity=${input.severity} affected=${input.affectedAreas.length}`,
    );

    await publikasikanAman("incident:created", async () => {
      const { eventBus, EVENT_NAMES } = await import("@/lib/event-bus");
      await eventBus.publish(EVENT_NAMES.INCIDENT_CREATED, {
        incidentId: incident.id,
        title: incident.title,
        severity: incident.severity,
        affectedAreas: incident.affectedAreas,
        isPublic: incident.isPublic,
        startedAt: incident.startedAt.toISOString(),
        createdById,
        tenantId,
        triggeredBy: createdById,
      });
    });
    return incident;
  }

  /**
   * Tambah update status. Insiden yang sudah selesai bersifat final (409): menyelesaikan
   * ulang dulu menimpa `resolvedAt` (durasi & MTTR salah) dan mengirim event selesai ganda.
   */
  async addUpdate(
    tenantId: string,
    incidentId: string,
    input: UpdateIncidentStatusInput,
    postedById: string | null,
  ): Promise<IncidentUpdateEntity> {
    const update = await this.repo.addUpdateIfOpen(tenantId, incidentId, { ...input, postedById });
    if (!update) {
      const incident = await this.repo.findById(tenantId, incidentId);
      throw incident
        ? createRouteServiceError(PESAN_SUDAH_SELESAI, HTTP_CONFLICT)
        : createRouteServiceError(PESAN_TIDAK_DITEMUKAN, HTTP_NOT_FOUND);
    }
    logger.info(`[Incident] ${incidentId} → ${input.status} by ${postedById ?? "system"}`);

    if (input.status === "RESOLVED") await this.publikasikanSelesai(tenantId, incidentId, postedById);
    return update;
  }

  /** Hapus insiden; 404 bila tidak ada di tenant ini. */
  async delete(tenantId: string, id: string): Promise<void> {
    if (!(await this.repo.delete(tenantId, id))) {
      throw createRouteServiceError(PESAN_TIDAK_DITEMUKAN, HTTP_NOT_FOUND);
    }
    logger.info(`[Incident] Deleted ${id}`);
  }

  /**
   * MTTR & sebaran severity insiden yang mulai dalam `windowDays` terakhir.
   * Waktu penyelesaian = `resolvedAt - startedAt`. Jumlah aktif mencakup semua
   * insiden yang belum selesai, termasuk yang mulai sebelum jendela.
   */
  async getAnalytics(tenantId: string, windowDays = ANALYTICS_WINDOW_DAYS): Promise<IncidentAnalytics> {
    const sejak = new Date(Date.now() - windowDays * MS_PER_HARI);
    const [dalamJendela, totalActive] = await Promise.all([
      this.repo.findStartedSince(tenantId, sejak),
      this.repo.countActive(tenantId),
    ]);

    const selesai = dalamJendela.filter(
      (incident): incident is IncidentEntity & { resolvedAt: Date } =>
        incident.status === "RESOLVED" && incident.resolvedAt !== null,
    );
    const totalMenit = selesai.reduce((acc, incident) => acc + durasiMenit(incident.startedAt, incident.resolvedAt), 0);

    const bySeverity: Record<SeverityLevel, number> = { CRITICAL: 0, MAJOR: 0, MINOR: 0 };
    for (const incident of dalamJendela) bySeverity[incident.severity as SeverityLevel] += 1;

    const recentlyResolved = [...selesai]
      .sort((a, b) => b.resolvedAt.getTime() - a.resolvedAt.getTime())
      .slice(0, JUMLAH_BARU_SELESAI)
      .map((incident) => ({
        id: incident.id,
        title: incident.title,
        severity: incident.severity as SeverityLevel,
        durationMinutes: durasiMenit(incident.startedAt, incident.resolvedAt),
        resolvedAt: incident.resolvedAt,
      }));

    return {
      windowDays,
      totalIncidents: dalamJendela.length,
      totalResolved: selesai.length,
      totalActive,
      avgResolutionMinutes: selesai.length > 0 ? Math.floor(totalMenit / selesai.length) : 0,
      bySeverity,
      recentlyResolved,
    };
  }

  private async publikasikanSelesai(tenantId: string, incidentId: string, postedById: string | null) {
    const incident = await this.repo.findById(tenantId, incidentId);
    if (!incident?.resolvedAt) return;
    const resolvedAt = incident.resolvedAt;
    await publikasikanAman("incident:resolved", async () => {
      const { eventBus, EVENT_NAMES } = await import("@/lib/event-bus");
      await eventBus.publish(EVENT_NAMES.INCIDENT_RESOLVED, {
        incidentId: incident.id,
        title: incident.title,
        severity: incident.severity,
        durationMinutes: durasiMenit(incident.startedAt, resolvedAt),
        resolvedAt: resolvedAt.toISOString(),
        resolvedById: postedById,
        tenantId,
        triggeredBy: postedById ?? undefined,
      });
    });
  }
}

let instance: IncidentService | null = null;

/** Singleton service insiden. */
export function getIncidentService(): IncidentService {
  instance ??= new IncidentService();
  return instance;
}
