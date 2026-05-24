import type { Supplier, SupplierStatus } from "../domain/entities/Supplier";
import type {
  ISupplierRepository,
  SupplierCreateInput,
  SupplierListFilter,
  SupplierListResult,
  SupplierUpdateInput,
} from "../domain/ports/ISupplierRepository";
import { SupplierRepository } from "../repositories/SupplierRepository";

export class SupplierCodeAlreadyExistsError extends Error {
  constructor(code: string) {
    super(`Supplier dengan kode ${code} sudah ada`);
    this.name = "SupplierCodeAlreadyExistsError";
  }
}

export class SupplierNotFoundError extends Error {
  constructor(id: string) {
    super(`Supplier ${id} tidak ditemukan`);
    this.name = "SupplierNotFoundError";
  }
}

/**
 * Dilempar oleh use case yang membutuhkan supplier aktif (mis. create PO).
 * Pesan default mencakup status terkini supaya caller bisa langsung tampilkan ke user.
 */
export class SupplierNotActiveError extends Error {
  constructor(
    public readonly supplierId: string,
    public readonly status: SupplierStatus,
    public readonly reason: string | null = null,
  ) {
    const reasonSuffix = reason ? ` (${reason})` : "";
    super(
      `Supplier ${supplierId} berstatus ${status} dan tidak dapat digunakan${reasonSuffix}`,
    );
    this.name = "SupplierNotActiveError";
  }
}

export class SupplierService {
  constructor(
    private readonly repo: ISupplierRepository = new SupplierRepository(),
  ) {}

  async create(input: SupplierCreateInput): Promise<Supplier> {
    const existing = await this.repo.findByCode(input.code);
    if (existing) {
      throw new SupplierCodeAlreadyExistsError(input.code);
    }
    this.assertBlacklistConsistency(input.status, input.blacklistReason);
    return this.repo.create(input);
  }

  async update(id: string, input: SupplierUpdateInput): Promise<Supplier> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new SupplierNotFoundError(id);
    }
    const targetStatus = input.status ?? existing.status;
    const targetReason =
      input.blacklistReason !== undefined
        ? input.blacklistReason
        : existing.blacklistReason;
    this.assertBlacklistConsistency(targetStatus, targetReason);
    return this.repo.update(id, input);
  }

  async getById(id: string): Promise<Supplier> {
    const supplier = await this.repo.findById(id);
    if (!supplier) {
      throw new SupplierNotFoundError(id);
    }
    return supplier;
  }

  async list(filter: SupplierListFilter): Promise<SupplierListResult> {
    return this.repo.list(filter);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new SupplierNotFoundError(id);
    }
    await this.repo.delete(id);
  }

  /**
   * Guard untuk use case yang butuh supplier aktif (mis. PO create/update).
   * Lempar `SupplierNotActiveError` kalau status bukan ACTIVE.
   */
  async assertActive(id: string): Promise<Supplier> {
    const supplier = await this.getById(id);
    if (supplier.status !== "ACTIVE") {
      throw new SupplierNotActiveError(
        supplier.id,
        supplier.status,
        supplier.blacklistReason,
      );
    }
    return supplier;
  }

  private assertBlacklistConsistency(
    status: SupplierStatus | undefined,
    reason: string | null | undefined,
  ): void {
    if (status === "BLACKLISTED" && (!reason || reason.trim() === "")) {
      throw new Error(
        "Alasan blacklist wajib diisi saat status supplier BLACKLISTED",
      );
    }
  }
}
