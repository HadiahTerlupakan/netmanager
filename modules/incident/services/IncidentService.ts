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
    return update;
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
    logger.info(`[Incident] Deleted ${id}`);
  }
}

let instance: IncidentService | null = null;

export function getIncidentService(): IncidentService {
  instance ??= new IncidentService();
  return instance;
}
