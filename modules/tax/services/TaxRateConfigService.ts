import type {
  CreateTaxRateConfigInput,
  TaxRateConfig,
  UpdateTaxRateConfigInput,
} from "../domain/entities/TaxRateConfig";
import type { ITaxRateConfigRepository } from "../domain/ports/ITaxRateConfigRepository";

/**
 * CRUD service untuk tarif pajak fleksibel.
 *
 * Validasi business rule (kode unik, format, dst.) dikerjakan di sini
 * sebelum delegasi ke repository. Service tidak akses Prisma langsung.
 */
export class TaxRateConfigService {
  constructor(private readonly repo: ITaxRateConfigRepository) {}

  list(tenantId: string): Promise<TaxRateConfig[]> {
    return this.repo.listByTenant(tenantId);
  }

  /**
   * Lookup tarif berdasarkan code untuk consumer (PpnRateResolver,
   * BhpUsoService, dst). Return rate dalam persen, atau null kalau
   * tidak ada / tidak aktif.
   */
  async getRateByCode(tenantId: string, code: string): Promise<number | null> {
    const config = await this.repo.findByCode(tenantId, code);
    if (!config || !config.isActive) return null;
    return config.rate;
  }

  async create(
    tenantId: string,
    input: CreateTaxRateConfigInput,
  ): Promise<TaxRateConfig> {
    this.validateInput(input);

    const existing = await this.repo.findByCode(tenantId, input.code);
    if (existing) {
      throw new Error(
        `CONFLICT: Kode "${input.code}" sudah dipakai untuk tarif pajak lain`,
      );
    }

    return this.repo.create(tenantId, input);
  }

  async update(
    id: string,
    tenantId: string,
    input: UpdateTaxRateConfigInput,
  ): Promise<TaxRateConfig> {
    if (input.rate !== undefined && (input.rate < 0 || input.rate > 100)) {
      throw new Error("VALIDATION: Tarif harus di antara 0 dan 100");
    }
    return this.repo.update(id, tenantId, input);
  }

  delete(id: string, tenantId: string): Promise<void> {
    return this.repo.delete(id, tenantId);
  }

  private validateInput(input: CreateTaxRateConfigInput): void {
    if (!input.code || !/^[A-Z0-9_]+$/.test(input.code)) {
      throw new Error(
        "VALIDATION: Code hanya boleh huruf besar, angka, dan underscore",
      );
    }
    if (input.code.length > 32) {
      throw new Error("VALIDATION: Code maksimal 32 karakter");
    }
    if (!input.name || input.name.trim().length === 0) {
      throw new Error("VALIDATION: Nama tarif wajib diisi");
    }
    if (input.rate < 0 || input.rate > 100) {
      throw new Error("VALIDATION: Tarif harus di antara 0 dan 100");
    }
    if (
      input.dueDay !== null &&
      input.dueDay !== undefined &&
      (input.dueDay < 1 || input.dueDay > 31)
    ) {
      throw new Error("VALIDATION: Jatuh tempo (tanggal) harus 1-31");
    }
    if (
      input.dueMonth !== null &&
      input.dueMonth !== undefined &&
      (input.dueMonth < 1 || input.dueMonth > 12)
    ) {
      throw new Error("VALIDATION: Jatuh tempo (bulan) harus 1-12");
    }
  }
}
