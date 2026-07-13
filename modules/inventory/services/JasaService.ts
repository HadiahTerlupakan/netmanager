import { logger } from "@/lib/logger";
import {
  getJasaRepository,
  type CreateJasaInput,
  type FindManyJasaParams,
  type JasaRepository,
  type UpdateJasaInput,
} from "../repositories/JasaRepository";

export type JasaServiceResult<T> =
  | { success: true; data: T; message?: string }
  | { success: false; status: number; error: string };

export interface CreateJasaServiceInput {
  userId: string;
  tenantId?: string | null;
  body: {
    kode?: string;
    nama: string;
    satuan?: string;
    supplierId?: string | null;
    hargaEstimasi?: number;
    kategoriPph?: string | null;
    deskripsi?: string | null;
    status?: string;
  };
}

export interface UpdateJasaServiceInput {
  id: string;
  userId: string;
  tenantId?: string | null;
  body: UpdateJasaInput;
}

/** Service master Jasa: list/create/update/soft-delete. */
export class JasaService {
  constructor(
    private readonly repository: JasaRepository = getJasaRepository(),
  ) {}

  async list(params: FindManyJasaParams) {
    return this.repository.findMany(params);
  }

  async getById(id: string, tenantId?: string | null) {
    const jasa = await this.repository.findById(id, tenantId);
    if (!jasa) {
      return {
        success: false as const,
        status: 404,
        error: "Jasa tidak ditemukan",
      };
    }
    return { success: true as const, data: jasa };
  }

  async create(
    input: CreateJasaServiceInput,
  ): Promise<JasaServiceResult<unknown>> {
    const { body, userId, tenantId } = input;
    if (!body.nama?.trim()) {
      return { success: false, status: 400, error: "Nama jasa wajib diisi" };
    }

    const kode = await this.resolveUniqueKode(body.kode, tenantId);
    const payload: CreateJasaInput = {
      kode,
      nama: body.nama.trim(),
      satuan: body.satuan?.trim() || "job",
      supplierId: body.supplierId ?? null,
      hargaEstimasi: Number(body.hargaEstimasi) || 0,
      kategoriPph: body.kategoriPph ?? null,
      deskripsi: body.deskripsi ?? null,
      status: body.status ?? "ACTIVE",
      tenantId: tenantId ?? null,
    };

    const jasa = await this.repository.create(payload);
    await logger.logActivity({
      action: "CREATE",
      subject: "Jasa",
      userId,
      details: { id: jasa.id, kode: jasa.kode, nama: jasa.nama },
    });

    return {
      success: true,
      data: { jasa },
      message: "Jasa berhasil dibuat",
    };
  }

  async update(
    input: UpdateJasaServiceInput,
  ): Promise<JasaServiceResult<unknown>> {
    if (input.body.kode) {
      const existing = await this.repository.findByKode(
        input.body.kode,
        input.tenantId,
      );
      if (existing && existing.id !== input.id) {
        return {
          success: false,
          status: 400,
          error: `Kode jasa ${input.body.kode} sudah digunakan`,
        };
      }
    }

    const jasa = await this.repository.update(
      input.id,
      input.body,
      input.tenantId,
    );
    if (!jasa) {
      return { success: false, status: 404, error: "Jasa tidak ditemukan" };
    }

    await logger.logActivity({
      action: "UPDATE",
      subject: "Jasa",
      userId: input.userId,
      details: { id: jasa.id, kode: jasa.kode, nama: jasa.nama },
    });

    return {
      success: true,
      data: { jasa },
      message: "Jasa berhasil diperbarui",
    };
  }

  async softDelete(
    id: string,
    userId: string,
    tenantId?: string | null,
  ): Promise<JasaServiceResult<unknown>> {
    const jasa = await this.repository.softDelete(id, tenantId);
    if (!jasa) {
      return { success: false, status: 404, error: "Jasa tidak ditemukan" };
    }

    await logger.logActivity({
      action: "DELETE",
      subject: "Jasa",
      userId,
      details: { id: jasa.id, kode: jasa.kode, nama: jasa.nama },
    });

    return {
      success: true,
      data: { jasa },
      message: "Jasa dinonaktifkan",
    };
  }

  private async resolveUniqueKode(
    requestedKode: string | undefined,
    tenantId?: string | null,
  ): Promise<string> {
    if (requestedKode?.trim()) {
      const existing = await this.repository.findByKode(
        requestedKode.trim(),
        tenantId,
      );
      if (existing) {
        throw new Error(`Kode jasa ${requestedKode.trim()} sudah digunakan`);
      }
      return requestedKode.trim().toUpperCase();
    }

    const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    for (let attempt = 1; attempt <= 50; attempt += 1) {
      const candidate = `JSA-${dateKey}-${String(attempt).padStart(3, "0")}`;
      const existing = await this.repository.findByKode(candidate, tenantId);
      if (!existing) return candidate;
    }
    return `JSA-${dateKey}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  }
}

let jasaServiceInstance: JasaService | null = null;

export function getJasaService(): JasaService {
  if (!jasaServiceInstance) jasaServiceInstance = new JasaService();
  return jasaServiceInstance;
}
