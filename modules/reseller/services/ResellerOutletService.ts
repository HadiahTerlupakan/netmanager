import type { ResellerOutletDTO } from "../dto/reseller.dto";
import type { ResellerOutletEntity } from "../domain/entities/ResellerEntity";
import type {
  CreateOutletData,
  IResellerRepository,
  UpdateOutletData,
} from "../domain/ports/IResellerRepository";
import {
  ResellerConflictError,
  ResellerNotFoundError,
  ResellerValidationError,
} from "../errors/reseller-errors";
import { ResellerMapper } from "../mappers/ResellerMapper";
import { ResellerRepository } from "../repositories/ResellerRepository";
import { trimOptionalText } from "./reseller-text";

const ACTIVE_STATUS = "ACTIVE";
const OUTLET_NOT_FOUND_MESSAGE = "Outlet reseller tidak ditemukan";
const DUPLICATE_OUTLET_CODE_MESSAGE = "Kode outlet sudah digunakan";
const DELETED_OUTLET_CODE_MESSAGE =
  "Kode outlet sudah pernah dipakai outlet yang telah dihapus. Gunakan kode lain.";

export type CreateOutletInput = Omit<
  CreateOutletData,
  "tenantId" | "resellerId"
>;

export class ResellerOutletService {
  constructor(
    private readonly repository: IResellerRepository = new ResellerRepository(),
  ) {}

  /** Create outlet after validating reseller and outlet code. */
  async createOutlet(
    tenantId: string,
    resellerId: string,
    data: CreateOutletInput,
  ): Promise<ResellerOutletDTO> {
    await this.assertActiveReseller(tenantId, resellerId);
    const normalized = this.normalizeCreateOutlet(tenantId, resellerId, data);
    await this.ensureOutletCodeIsUnique(tenantId, resellerId, normalized.code);
    const outlet = await this.repository.createOutlet(normalized);
    return ResellerMapper.toOutletDTO(outlet);
  }

  /** List reseller outlets. */
  async listOutlets(
    tenantId: string,
    resellerId: string,
  ): Promise<readonly ResellerOutletDTO[]> {
    await this.assertResellerExists(tenantId, resellerId);
    const outlets = await this.repository.findOutletsByResellerId(
      tenantId,
      resellerId,
    );
    return outlets.map((outlet) => ResellerMapper.toOutletDTO(outlet));
  }

  /** Get outlet detail and validate reseller ownership. */
  async getOutletById(
    tenantId: string,
    resellerId: string,
    outletId: string,
  ): Promise<ResellerOutletDTO | null> {
    const reseller = await this.repository.findById(tenantId, resellerId);
    if (!reseller) return null;
    const outlet = await this.repository.findOutletById(tenantId, outletId);
    if (!outlet || outlet.resellerId !== resellerId) {
      return null;
    }
    return ResellerMapper.toOutletDTO(outlet);
  }

  /**
   * Update outlet after validating ownership. Status outlet sengaja tidak
   * diperiksa: outlet nonaktif harus tetap bisa diedit dan diaktifkan lagi.
   */
  async updateOutlet(
    tenantId: string,
    resellerId: string,
    outletId: string,
    data: UpdateOutletData,
  ): Promise<ResellerOutletDTO> {
    const outlet = await this.findOwnedOutlet(tenantId, resellerId, outletId);
    const code = data.code?.trim();
    if (code && code !== outlet.code) {
      await this.ensureOutletCodeIsUnique(tenantId, resellerId, code);
    }
    const updated = await this.repository.updateOutlet(tenantId, outletId, {
      ...data,
      code,
      name: data.name?.trim(),
      phone: trimOptionalText(data.phone),
      address: trimOptionalText(data.address),
    });
    return ResellerMapper.toOutletDTO(updated);
  }

  /** Soft-delete outlet after validating ownership, whatever its status. */
  async deleteOutlet(
    tenantId: string,
    resellerId: string,
    outletId: string,
  ): Promise<void> {
    await this.findOwnedOutlet(tenantId, resellerId, outletId);
    await this.repository.softDeleteOutlet(tenantId, outletId);
  }

  /**
   * Outlet milik reseller ini, atau 404. Reseller yang sudah dihapus dan
   * outlet milik reseller lain diperlakukan sama dengan tidak ada, seperti
   * `listOutlets` dan `getOutletById` (soft delete reseller tidak ikut menghapus
   * outlet-nya).
   */
  private async findOwnedOutlet(
    tenantId: string,
    resellerId: string,
    outletId: string,
  ): Promise<ResellerOutletEntity> {
    await this.assertResellerExists(tenantId, resellerId);
    const outlet = await this.repository.findOutletById(tenantId, outletId);
    if (!outlet || outlet.resellerId !== resellerId) {
      throw new ResellerNotFoundError(OUTLET_NOT_FOUND_MESSAGE);
    }
    return outlet;
  }

  /**
   * Tolak kode yang dipegang outlet lain di reseller yang sama, termasuk
   * outlet yang sudah dihapus (unique index mencakup baris soft-delete).
   */
  private async ensureOutletCodeIsUnique(
    tenantId: string,
    resellerId: string,
    code: string,
  ): Promise<void> {
    const existing = await this.repository.findOutletByCode(
      tenantId,
      resellerId,
      code,
    );
    if (!existing) return;
    throw new ResellerConflictError(
      existing.deletedAt
        ? DELETED_OUTLET_CODE_MESSAGE
        : DUPLICATE_OUTLET_CODE_MESSAGE,
    );
  }

  private async assertResellerExists(
    tenantId: string,
    resellerId: string,
  ): Promise<void> {
    const reseller = await this.repository.findById(tenantId, resellerId);
    if (!reseller) {
      throw new ResellerNotFoundError();
    }
  }

  private async assertActiveReseller(
    tenantId: string,
    resellerId: string,
  ): Promise<void> {
    const reseller = await this.repository.findById(tenantId, resellerId);
    if (!reseller) {
      throw new ResellerNotFoundError();
    }
    if (reseller.status !== ACTIVE_STATUS) {
      throw new ResellerValidationError("Reseller tidak aktif");
    }
  }

  private normalizeCreateOutlet(
    tenantId: string,
    resellerId: string,
    data: CreateOutletInput,
  ): CreateOutletData {
    return {
      tenantId,
      resellerId,
      code: data.code.trim(),
      name: data.name.trim(),
      phone: trimOptionalText(data.phone) ?? null,
      address: trimOptionalText(data.address) ?? null,
      status: data.status,
    };
  }
}

let resellerOutletService: ResellerOutletService | null = null;

/** Get singleton reseller outlet service. */
export function getResellerOutletService(): ResellerOutletService {
  if (!resellerOutletService) {
    resellerOutletService = new ResellerOutletService();
  }
  return resellerOutletService;
}
