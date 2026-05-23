import type { Supplier } from "../domain/entities/Supplier";
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

export class SupplierService {
  constructor(
    private readonly repo: ISupplierRepository = new SupplierRepository(),
  ) {}

  async create(input: SupplierCreateInput): Promise<Supplier> {
    const existing = await this.repo.findByCode(input.code);
    if (existing) {
      throw new SupplierCodeAlreadyExistsError(input.code);
    }
    return this.repo.create(input);
  }

  async update(id: string, input: SupplierUpdateInput): Promise<Supplier> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new SupplierNotFoundError(id);
    }
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
}
