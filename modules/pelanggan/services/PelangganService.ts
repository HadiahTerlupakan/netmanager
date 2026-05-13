import type {
  FilterOptions,
  IPelangganRepository,
} from "../domain/ports/IPelangganRepository";
import type {
  PelangganEntity,
  PelangganWithPackageEntity,
} from "../domain/entities/PelangganEntity";
import { PelangganRepository } from "../repositories/PelangganRepository";
/**
 * NOTE: Prisma enums are intentionally imported here.
 * These are domain enums (Status, TipePelanggan, DiscountType, DurasiUnit) that are
 * defined in Prisma schema and used throughout the domain layer.
 * Duplicating these enums would create maintenance burden and potential inconsistencies.
 * This is a valid use case and does not violate Clean Architecture principles.
 */
import type { Status } from "@prisma/client";
import type { CreatePelangganInput } from "./pelanggan-service.contracts";
import { CustomerEventDispatcher } from "@/modules/events";
import { logger } from "@/lib/logger";
import {
  buildCreatePelangganData,
  syncCreatedCustomerToRadius,
  syncUpdatedCustomerStatus,
  triggerCustomerBilling,
  validateCreatePelangganInput,
  validateDeletedCustomer,
} from "./pelanggan-service.helpers";

export type { CreatePelangganInput } from "./pelanggan-service.contracts";

export class PelangganService {
  private pelangganRepository: IPelangganRepository;

  constructor(
    pelangganRepository: IPelangganRepository = new PelangganRepository(),
  ) {
    this.pelangganRepository = pelangganRepository;
  }

  /** Get all customers using optional filters. */
  async getAllPelanggan(
    filter?: FilterOptions,
  ): Promise<PelangganWithPackageEntity[]> {
    return this.pelangganRepository.findAll(filter);
  }

  /** Get paginated customers using optional filters. */
  async getAllPelangganPaginated(
    filter?: FilterOptions,
    page: number = 1,
    limit: number = 10,
  ) {
    return this.pelangganRepository.findAllPaginated(filter, page, limit);
  }

  /** Get customer by internal id. */
  async getPelanggan(id: string): Promise<PelangganEntity | null> {
    return this.pelangganRepository.findById(id);
  }

  /** Get customer by customer code. */
  async getPelangganByIdPelanggan(
    idPelanggan: string,
  ): Promise<PelangganEntity | null> {
    return this.pelangganRepository.findByIdPelanggan(idPelanggan);
  }

  /** Create customer and trigger related side effects. */
  async createPelanggan(
    data: CreatePelangganInput,
  ): Promise<PelangganWithPackageEntity> {
    await validateCreatePelangganInput(this.pelangganRepository, data);
    const createData = await buildCreatePelangganData(data);
    const pelanggan = await this.pelangganRepository.create(createData);

    // syncCreatedCustomerToRadius sudah emit CUSTOMER_CREATED event ke BullMQ
    await syncCreatedCustomerToRadius(this.pelangganRepository, pelanggan);
    await triggerCustomerBilling(pelanggan.id, data.billingAction);

    return pelanggan;
  }

  /** Delete customer setelah validasi, lalu emit event CUSTOMER_DELETED. */
  async deletePelanggan(id: string): Promise<PelangganEntity> {
    const existing = await validateDeletedCustomer(
      this.pelangganRepository,
      id,
    );
    const deleted = await this.pelangganRepository.delete(id);

    // Emit event setelah record terhapus — handler async cleanup MikroTik/RADIUS
    CustomerEventDispatcher.onDeleted({
      customerId: existing.id,
      customerName: existing.nama,
      username: existing.username,
      tenantId: existing.tenantId ?? undefined,
    }).catch((err) =>
      logger.error(
        "[Pelanggan] Gagal publish CUSTOMER_DELETED event:",
        err instanceof Error ? err : undefined,
      ),
    );

    return deleted;
  }

  /** Update customer status and trigger radius synchronization. */
  async updateStatusPelanggan(
    id: string,
    status: Status,
  ): Promise<PelangganEntity> {
    const existing = await this.pelangganRepository.findById(id);
    if (!existing) {
      throw new Error("Pelanggan tidak ditemukan");
    }

    const pelanggan = await this.pelangganRepository.update(id, { status });
    await syncUpdatedCustomerStatus(this.pelangganRepository, {
      id,
      existing,
      pelanggan,
    });
    return pelanggan;
  }

  /**
   * Update sync status (SYNCED | FAILED | PENDING) untuk integrasi MikroTik/RADIUS.
   * Dipanggil oleh handler network setelah operasi sync selesai.
   */
  async updateSyncStatus(
    id: string,
    status: "PENDING" | "SYNCED" | "FAILED",
    error?: string | null,
  ): Promise<void> {
    await this.pelangganRepository.updateSyncStatus(id, status, error ?? null);
  }
}

let pelangganServiceInstance: PelangganService | null = null;

export function getPelangganService(): PelangganService {
  if (!pelangganServiceInstance) {
    pelangganServiceInstance = new PelangganService();
  }
  return pelangganServiceInstance;
}
