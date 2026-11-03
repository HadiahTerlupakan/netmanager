import type { ResellerDTO } from "../dto/reseller.dto";
import type { ResellerStatusValue } from "../domain/entities/ResellerEntity";
import type {
  CreateResellerData,
  IResellerRepository,
  ResellerLicenseData,
  ResellerStatusAuditData,
  UpdateResellerData,
} from "../domain/ports/IResellerRepository";
import {
  ResellerConflictError,
  ResellerNotFoundError,
} from "../errors/reseller-errors";
import { ResellerMapper } from "../mappers/ResellerMapper";
import { ResellerRepository } from "../repositories/ResellerRepository";
import {
  type LicenseInput,
  resolveLicenseData,
  resolveStatusData,
  type StatusInput,
} from "./reseller-partnership-rules";
import { trimOptionalText } from "./reseller-text";

const DUPLICATE_CODE_MESSAGE = "Kode reseller sudah digunakan";
const DELETED_CODE_MESSAGE =
  "Kode reseller sudah pernah dipakai reseller yang telah dihapus. Gunakan kode lain.";

/** Masukan pembuatan reseller dari route admin (sudah lolos Zod). */
export interface CreateResellerInput
  extends
    Omit<
      CreateResellerData,
      "tenantId" | keyof ResellerLicenseData | keyof ResellerStatusAuditData
    >,
    LicenseInput,
    StatusInput {
  readonly tenantId: string;
  /** User yang membuat; dicatat sebagai pengubah status/verifikator izin. */
  readonly actorId?: string | null;
}

/** Masukan perubahan reseller dari route admin (sudah lolos Zod). */
export interface UpdateResellerInput
  extends
    Omit<
      UpdateResellerData,
      keyof ResellerLicenseData | keyof ResellerStatusAuditData
    >,
    LicenseInput,
    StatusInput {}

export class ResellerService {
  constructor(
    private readonly repository: IResellerRepository = new ResellerRepository(),
  ) {}

  /** Create reseller after ensuring code uniqueness in tenant scope. */
  async createReseller(data: CreateResellerInput): Promise<ResellerDTO> {
    const normalized = this.normalizeCreateData(data);
    await this.ensureCodeIsUnique(data.tenantId, normalized.code);
    const reseller = await this.repository.create(normalized);
    return ResellerMapper.toDTO(reseller);
  }

  /**
   * List resellers in tenant scope. Read paths accept `null` because
   * `modules/legal` passes the request tenant context as-is.
   */
  async listResellers(params: {
    readonly tenantId: string | null;
    readonly page?: number;
    readonly limit?: number;
    /** Kata kunci nama, kode, atau telepon. */
    readonly search?: string;
    readonly status?: ResellerStatusValue;
  }): Promise<{
    readonly items: readonly ResellerDTO[];
    readonly total: number;
  }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const result = await this.repository.findAll({
      tenantId: params.tenantId,
      search: params.search,
      status: params.status,
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      items: result.items.map((item) => ResellerMapper.toDTO(item)),
      total: result.total,
    };
  }

  /** Get reseller detail by tenant and id. */
  async getResellerById(
    tenantId: string | null,
    id: string,
  ): Promise<ResellerDTO | null> {
    const reseller = await this.repository.findById(tenantId, id);
    return reseller ? ResellerMapper.toDTO(reseller) : null;
  }

  /**
   * Update reseller after validating existence and duplicate code. Perubahan
   * status dan verifikasi izin dicatat atas nama `actorId`.
   *
   * @throws ResellerValidationError alasan SUSPENDED/TERMINATED kosong, atau
   *   izin ditandai terverifikasi padahal belum lengkap.
   */
  async updateReseller(
    tenantId: string,
    id: string,
    data: UpdateResellerInput,
    actorId: string | null = null,
  ): Promise<ResellerDTO> {
    const existing = await this.repository.findById(tenantId, id);
    if (!existing) {
      throw new ResellerNotFoundError();
    }
    const code = data.code?.trim();
    if (code && code !== existing.code) {
      await this.ensureCodeIsUnique(tenantId, code);
    }
    const actor = { actorId, now: new Date() };
    const updated = await this.repository.update(tenantId, id, {
      code,
      name: data.name?.trim(),
      email: trimOptionalText(data.email),
      phone: trimOptionalText(data.phone),
      address: trimOptionalText(data.address),
      notes: trimOptionalText(data.notes),
      ...resolveStatusData(data, existing.status, actor),
      ...resolveLicenseData(data, existing, actor),
    });
    return ResellerMapper.toDTO(updated);
  }

  /**
   * Soft-delete reseller by tenant and id. `actorId` dicatat sebagai pelaku
   * perubahan status di riwayat kemitraan.
   */
  async deleteReseller(
    tenantId: string,
    id: string,
    actorId: string | null = null,
  ): Promise<void> {
    await this.repository.softDelete(tenantId, id, actorId);
  }

  private normalizeCreateData(data: CreateResellerInput): CreateResellerData {
    const actor = { actorId: data.actorId ?? null, now: new Date() };
    return {
      tenantId: data.tenantId,
      code: data.code.trim(),
      name: data.name.trim(),
      email: trimOptionalText(data.email) ?? null,
      phone: trimOptionalText(data.phone) ?? null,
      address: trimOptionalText(data.address) ?? null,
      notes: trimOptionalText(data.notes) ?? null,
      ...resolveStatusData(data, null, actor),
      ...resolveLicenseData(data, null, actor),
    };
  }

  /**
   * Tolak kode yang sudah dipegang reseller lain, termasuk yang sudah
   * dihapus: unique index `[tenantId, code]` mencakup baris soft-delete, jadi
   * tanpa pesan khusus admin hanya menerima 409 generik untuk kode yang tidak
   * terlihat lagi di daftar.
   */
  private async ensureCodeIsUnique(
    tenantId: string,
    code: string,
  ): Promise<void> {
    const existing = await this.repository.findByCode(tenantId, code);
    if (!existing) return;
    throw new ResellerConflictError(
      existing.deletedAt ? DELETED_CODE_MESSAGE : DUPLICATE_CODE_MESSAGE,
    );
  }
}

let resellerService: ResellerService | null = null;

/** Get singleton reseller service. */
export function getResellerService(): ResellerService {
  if (!resellerService) {
    resellerService = new ResellerService();
  }
  return resellerService;
}
