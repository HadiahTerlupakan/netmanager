import { logger } from "@/lib/logger";
import {
  getIncidentRepository,
  type IncidentEntity,
  type IncidentWithUpdates,
  type IncidentUpdateEntity,
  type CreateIncidentInput,
  type UpdateIncidentStatusInput,
} from "../repositories/IncidentRepository";
import type { IncidentStatus } from "@prisma/client";

export type SeverityLevel = "CRITICAL" | "MAJOR" | "MINOR";

export interface IncidentAnalytics {
  windowDays: number;
  totalIncidents: number;
  totalResolved: number;
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

const ANALYTICS_WINDOW_DAYS = 30;

/** Service business logic untuk Incident Management. */
export class IncidentService {
  constructor(private readonly repo = getIncidentRepository()) {}

  /** List incident — filter by status (ACTIVE = belum RESOLVED) atau publicOnly. */
  async list(filters: {
    status?: IncidentStatus | "ACTIVE";
    publicOnly?: boolean;
    limit?: number;
  }): Promise<IncidentEntity[]> {
    return this.repo.findMany(filters);
  }

  async getById(id: string): Promise<IncidentWithUpdates | null> {
    return this.repo.findById(id);
  }

  /** Create incident baru + auto-add initial update INVESTIGATING. */
  async create(
    input: CreateIncidentInput,
    createdById: string,
  ): Promise<IncidentEntity> {
    const incident = await this.repo.create({ ...input, createdById });

    // Auto-add initial update sebagai history awal.
    await this.repo.addUpdate(incident.id, {
      status: "INVESTIGATING",
      message: input.description,
      postedById: createdById,
    });

    logger.info(
      `[Incident] Created ${incident.id} severity=${input.severity} affected=${input.affectedAreas.length}`,
    );

    const { eventBus, EVENT_NAMES } = await import("@/lib/event-bus");
    await eventBus.publish(EVENT_NAMES.INCIDENT_CREATED, {
      incidentId: incident.id,
      title: incident.title,
      severity: incident.severity,
      affectedAreas: incident.affectedAreas,
      isPublic: incident.isPublic,
      startedAt: incident.startedAt.toISOString(),
      createdById,
      tenantId: incident.tenantId ?? undefined,
      triggeredBy: createdById,
    });

    return incident;
  }

  /** Tambah update status — auto-set resolvedAt kalau status RESOLVED. */
  async addUpdate(
    incidentId: string,
    input: UpdateIncidentStatusInput,
    postedById: string | null,
  ): Promise<IncidentUpdateEntity> {
    const update = await this.repo.addUpdate(incidentId, {
      ...input,
      postedById,
    });
    logger.info(
      `[Incident] ${incidentId} → ${input.status} by ${postedById ?? "system"}`,
    );

    if (input.status === "RESOLVED") {
      const incident = await this.repo.findById(incidentId);
      if (incident?.resolvedAt) {
        const durationMinutes = Math.floor(
          (incident.resolvedAt.getTime() - incident.startedAt.getTime()) /
            (1000 * 60),
        );

        const { eventBus, EVENT_NAMES } = await import("@/lib/event-bus");
        await eventBus.publish(EVENT_NAMES.INCIDENT_RESOLVED, {
          incidentId: incident.id,
          title: incident.title,
          severity: incident.severity,
          durationMinutes,
          resolvedAt: incident.resolvedAt.toISOString(),
          resolvedById: postedById,
          tenantId: incident.tenantId ?? undefined,
          triggeredBy: postedById ?? undefined,
        });
      }
    }

    return update;
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
    logger.info(`[Incident] Deleted ${id}`);
  }

  /**
   * Hitung MTTR analytics dari incident `windowDays` terakhir.
   * Resolution time = `resolvedAt - startedAt` per incident yang sudah RESOLVED.
   */
  async getAnalytics(
    windowDays = ANALYTICS_WINDOW_DAYS,
  ): Promise<IncidentAnalytics> {
    const since = new Date();
    since.setDate(since.getDate() - windowDays);

    const recent = await this.repo.findMany({ limit: 500 });
    const inWindow = recent.filter((i) => i.startedAt >= since);

    const resolved = inWindow.filter(
      (i) => i.status === "RESOLVED" && i.resolvedAt,
    );
    const active = inWindow.filter((i) => i.status !== "RESOLVED");

    const totalResolutionMs = resolved.reduce((acc, i) => {
      if (!i.resolvedAt) return acc;
      return acc + (i.resolvedAt.getTime() - i.startedAt.getTime());
    }, 0);

    const avgResolutionMinutes =
      resolved.length > 0
        ? Math.floor(totalResolutionMs / resolved.length / 1000 / 60)
        : 0;

    const bySeverity: Record<SeverityLevel, number> = {
      CRITICAL: 0,
      MAJOR: 0,
      MINOR: 0,
    };
    for (const inc of inWindow) {
      bySeverity[inc.severity as SeverityLevel]++;
    }

    const recentlyResolved = resolved
      .sort(
        (a, b) =>
          (b.resolvedAt?.getTime() ?? 0) - (a.resolvedAt?.getTime() ?? 0),
      )
      .slice(0, 10)
      .map((i) => ({
        id: i.id,
        title: i.title,
        severity: i.severity as SeverityLevel,
        durationMinutes: i.resolvedAt
          ? Math.floor(
              (i.resolvedAt.getTime() - i.startedAt.getTime()) / 1000 / 60,
            )
          : 0,
        resolvedAt: i.resolvedAt!,
      }));

    return {
      windowDays,
      totalIncidents: inWindow.length,
      totalResolved: resolved.length,
      totalActive: active.length,
      avgResolutionMinutes,
      bySeverity,
      recentlyResolved,
    };
  }
}

let instance: IncidentService | null = null;

export function getIncidentService(): IncidentService {
  instance ??= new IncidentService();
  return instance;
}
