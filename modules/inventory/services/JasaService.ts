import { logger } from "@/lib/logger";
import {
  getJasaRepository,
  type CreateJasaInput,
  type FindManyJasaParams,
  type JasaRepository,
  type UpdateJasaInput,
} from "../repositories/JasaRepository";
import {
  isPrismaError,
  pesanGagalHapus,
  pesanGagalSimpan,
  pesanTidakDitemukan,
  translateMasterDataError,
  type MasterDataErrorTranslation,
  type MasterDataFailure,
} from "./inventory-master-data-errors";

export type JasaServiceResult<T> =
  | { success: true; data: T; message?: string }
  | MasterDataFailure;

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;

const PESAN_JASA_TIDAK_DITEMUKAN = pesanTidakDitemukan("Jasa");

/** Kode jasa yang diminta sudah dipakai jasa lain. */
export class JasaKodeDipakaiError extends Error {
  constructor(kode: string, namaPemakai?: string) {
    const pemakai = namaPemakai ? ` "${namaPemakai}"` : " lain";
    super(
      `Kode jasa "${kode}" sudah dipakai jasa${pemakai}. Pakai kode lain, atau kosongkan kolom kode supaya dibuat otomatis.`,
    );
    this.name = "JasaKodeDipakaiError";
  }
}

/** Error simpan jasa yang dikenali dan diterjemahkan untuk staf. */
const SIMPAN_JASA_ERRORS: readonly MasterDataErrorTranslation[] = [
  {
    matches: (error) => error instanceof JasaKodeDipakaiError,
    status: HTTP_CONFLICT,
    message: (error) => error.message,
  },
  {
    matches: isPrismaError("P2002"),
    status: HTTP_CONFLICT,
    message: "Kode jasa itu sudah dipakai jasa lain. Pakai kode lain.",
  },
  {
    matches: isPrismaError("P2003"),
    status: HTTP_BAD_REQUEST,
    message:
      "Supplier yang dipilih tidak ditemukan. Mungkin sudah dihapus. Pilih supplier lain atau kosongkan kolom supplier.",
  },
  {
    matches: isPrismaError("P2025"),
    status: HTTP_NOT_FOUND,
    message: PESAN_JASA_TIDAK_DITEMUKAN,
  },
];

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
        status: HTTP_NOT_FOUND,
        error: PESAN_JASA_TIDAK_DITEMUKAN,
      };
    }
    return { success: true as const, data: jasa };
  }

  async create(
    input: CreateJasaServiceInput,
  ): Promise<JasaServiceResult<unknown>> {
    const { body, userId, tenantId } = input;
    if (!body.nama?.trim()) {
      return {
        success: false,
        status: HTTP_BAD_REQUEST,
        error:
          "Nama jasa belum diisi. Tulis nama jasanya, contoh: Pemasangan Tiang.",
      };
    }

    try {
      return await this.createJasa(body, userId, tenantId);
    } catch (error: unknown) {
      return translateMasterDataError(error, SIMPAN_JASA_ERRORS, {
        message: pesanGagalSimpan("Jasa"),
        logContext: "Jasa gagal dibuat",
      });
    }
  }

  private async createJasa(
    body: CreateJasaServiceInput["body"],
    userId: string,
    tenantId?: string | null,
  ): Promise<JasaServiceResult<unknown>> {
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
          status: HTTP_CONFLICT,
          error: new JasaKodeDipakaiError(input.body.kode, existing.nama)
            .message,
        };
      }
    }

    let jasa: Awaited<ReturnType<JasaRepository["update"]>>;
    try {
      jasa = await this.repository.update(input.id, input.body, input.tenantId);
    } catch (error: unknown) {
      return translateMasterDataError(error, SIMPAN_JASA_ERRORS, {
        message: pesanGagalSimpan("Perubahan jasa"),
        logContext: "Jasa gagal diubah",
      });
    }
    if (!jasa) {
      return {
        success: false,
        status: HTTP_NOT_FOUND,
        error: PESAN_JASA_TIDAK_DITEMUKAN,
      };
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
    let jasa: Awaited<ReturnType<JasaRepository["softDelete"]>>;
    try {
      jasa = await this.repository.softDelete(id, tenantId);
    } catch (error: unknown) {
      return translateMasterDataError(error, SIMPAN_JASA_ERRORS, {
        message: pesanGagalHapus("Jasa"),
        logContext: "Jasa gagal dinonaktifkan",
      });
    }
    if (!jasa) {
      return {
        success: false,
        status: HTTP_NOT_FOUND,
        error: PESAN_JASA_TIDAK_DITEMUKAN,
      };
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
      // Kode disimpan dalam huruf besar, jadi cek bentrok dengan bentuk yang
      // sama; tanpa ini "jsa-01" lolos cek lalu ditolak database karena
      // "JSA-01" sudah ada.
      const kode = requestedKode.trim().toUpperCase();
      const existing = await this.repository.findByKode(kode, tenantId);
      if (existing) throw new JasaKodeDipakaiError(kode, existing.nama);
      return kode;
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
