import type { IncidentSeverity, IncidentStatus, Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export interface IncidentEntity {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  affectedAreas: string[];
  startedAt: Date;
  resolvedAt: Date | null;
  isPublic: boolean;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  tenantId: string | null;
}

export interface IncidentWithUpdates extends IncidentEntity {
  updates: IncidentUpdateEntity[];
  user?: { id: string; name: string | null } | null;
}

export interface IncidentUpdateEntity {
  id: string;
  incidentId: string;
  status: IncidentStatus;
  message: string;
  postedById: string | null;
  createdAt: Date;
  tenantId: string | null;
  user?: { id: string; name: string | null } | null;
}

export interface CreateIncidentInput {
  title: string;
  description: string;
  severity: IncidentSeverity;
  affectedAreas: string[];
  isPublic?: boolean;
}

export interface UpdateIncidentStatusInput {
  status: IncidentStatus;
  message: string;
}

/** Saringan daftar insiden; `tenantId` kosong hanya untuk halaman status publik (tenant dari host). */
export interface IncidentListFilter {
  tenantId?: string;
  status?: IncidentStatus | "ACTIVE";
  publicOnly?: boolean;
  limit?: number;
}

const STATUS_SELESAI: IncidentStatus = "RESOLVED";
const BATAS_DAFTAR_BAWAAN = 50;

const updateInclude = {
  user: { select: { id: true, name: true } },
};

const incidentInclude = {
  updates: { include: updateInclude, orderBy: { createdAt: "desc" } },
  user: { select: { id: true, name: true } },
} as const;

/**
 * Data insiden gangguan layanan. Jalur admin selalu menyaring `tenantId`
 * eksplisit; halaman status publik (tanpa sesi) mengandalkan ekstensi tenant
 * yang menurunkan tenant dari host secara fail-closed.
 */
export class IncidentRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  /** Daftar insiden terbaru (mulai paling akhir dulu). */
  async findMany(filter: IncidentListFilter): Promise<IncidentEntity[]> {
    const { tenantId, status, publicOnly, limit = BATAS_DAFTAR_BAWAAN } = filter;
    const where: Prisma.IncidentWhereInput = {
      ...(tenantId ? { tenantId } : {}),
      ...(publicOnly ? { isPublic: true } : {}),
      ...(status === "ACTIVE" ? { status: { not: STATUS_SELESAI } } : status ? { status } : {}),
    };
    return this.client.incident.findMany({ where, orderBy: { startedAt: "desc" }, take: limit });
  }

  /** Detail insiden tenant beserta riwayat update (terbaru dulu); null bila tidak ada. */
  async findById(tenantId: string, id: string): Promise<IncidentWithUpdates | null> {
    return this.client.incident.findFirst({
      where: { id, tenantId },
      include: incidentInclude,
    }) as Promise<IncidentWithUpdates | null>;
  }

  /** Insiden tenant yang mulai sejak `sejak` (untuk analytics). */
  async findStartedSince(tenantId: string, sejak: Date): Promise<IncidentEntity[]> {
    return this.client.incident.findMany({ where: { tenantId, startedAt: { gte: sejak } } });
  }

  /** Jumlah insiden tenant yang belum selesai, kapan pun mulainya. */
  async countActive(tenantId: string): Promise<number> {
    return this.client.incident.count({ where: { tenantId, status: { not: STATUS_SELESAI } } });
  }

  /** Simpan insiden baru beserta update awal INVESTIGATING (satu transaksi). */
  async createWithInitialUpdate(
    tenantId: string,
    input: CreateIncidentInput & { createdById: string },
  ): Promise<IncidentEntity> {
    return this.client.$transaction(async (tx) => {
      const incident = await tx.incident.create({
        data: {
          id: globalThis.crypto.randomUUID(),
          title: input.title,
          description: input.description,
          severity: input.severity,
          affectedAreas: input.affectedAreas,
          isPublic: input.isPublic ?? true,
          createdById: input.createdById,
          tenantId,
          updatedAt: new Date(),
        },
      });
      await tx.incidentUpdate.create({
        data: {
          id: globalThis.crypto.randomUUID(),
          incidentId: incident.id,
          status: "INVESTIGATING",
          message: input.description,
          postedById: input.createdById,
          tenantId,
        },
      });
      return incident;
    });
  }

  /**
   * Catat update status. Hanya untuk insiden yang belum selesai — penjaga
   * `status: { not: RESOLVED }` di where membuat dua penyelesaian bersamaan tidak
   * saling menimpa `resolvedAt`. Mengembalikan null bila insiden tidak ada / sudah selesai.
   */
  async addUpdateIfOpen(
    tenantId: string,
    incidentId: string,
    input: UpdateIncidentStatusInput & { postedById: string | null },
  ): Promise<IncidentUpdateEntity | null> {
    const now = new Date();
    const isSelesai = input.status === STATUS_SELESAI;
    return this.client.$transaction(async (tx) => {
      const { count } = await tx.incident.updateMany({
        where: { id: incidentId, tenantId, status: { not: STATUS_SELESAI } },
        data: { status: input.status, updatedAt: now, ...(isSelesai ? { resolvedAt: now } : {}) },
      });
      if (count === 0) return null;
      return tx.incidentUpdate.create({
        data: {
          id: globalThis.crypto.randomUUID(),
          incidentId,
          status: input.status,
          message: input.message,
          postedById: input.postedById,
          tenantId,
        },
        include: updateInclude,
      }) as Promise<IncidentUpdateEntity>;
    });
  }

  /** Hapus insiden tenant; false bila tidak ada. */
  async delete(tenantId: string, id: string): Promise<boolean> {
    const { count } = await this.client.incident.deleteMany({ where: { id, tenantId } });
    return count > 0;
  }
}

let instance: IncidentRepository | null = null;

/** Singleton repository insiden. */
export function getIncidentRepository(): IncidentRepository {
  instance ??= new IncidentRepository();
  return instance;
}
