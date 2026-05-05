import { RadiusRepository } from "../repositories/RadiusRepository";
import { HargaPaketRepository } from "../repositories/HargaPaketRepository";
import type {
  HargaPaketCreateInput,
  HargaPaketUpdateInput,
  HargaPaketFilterOptions,
} from "../repositories/HargaPaketRepository";
import { logActivitySafe } from "@/lib/logger";
import { syncMikroTikRateLimit, syncRadiusPackage } from "./harga-paket.sync";
import {
  sanitizeHargaPaketUpdateInput,
  validateHargaPaketCreateInput,
} from "./harga-paket.validation";

/**
 * Service for HargaPaket business logic
 */
export class HargaPaketService {
  constructor(
    private readonly repository: HargaPaketRepository = new HargaPaketRepository(),
    private readonly radiusRepository: RadiusRepository = new RadiusRepository(),
  ) {}

  /**
   * Get all harga pakets with site restriction
   */
  async getAllHargaPakets(options: HargaPaketFilterOptions = {}) {
    return this.repository.findAll(options);
  }

  /**
   * Get harga paket by ID
   */
  async getHargaPaketById(id: string) {
    const hargaPaket = await this.repository.findById(id);
    if (!hargaPaket) {
      throw new Error("Harga paket tidak ditemukan");
    }
    return hargaPaket;
  }

  /**
   * Create new harga paket with validation
   */
  async createHargaPaket(
    data: Partial<HargaPaketCreateInput>,
    userId?: string,
  ) {
    const hargaPaket = await this.repository.create(
      validateHargaPaketCreateInput(data),
    );

    await Promise.all([
      syncMikroTikRateLimit(hargaPaket),
      syncRadiusPackage({
        packageId: hargaPaket.id,
        radiusRepository: this.radiusRepository,
        errorMessage: "[HargaPaketService] RADIUS sync error:",
      }),
    ]);

    if (userId) {
      logActivitySafe({
        action: "CREATE",
        subject: "Harga Paket",
        userId,
        details: {
          id: hargaPaket.id,
          name: hargaPaket.name,
          price: hargaPaket.harga,
        },
      });
    }

    return hargaPaket;
  }

  /**
   * Update harga paket
   */
  async updateHargaPaket(
    id: string,
    data: Partial<HargaPaketUpdateInput> & { bandwidthId?: string | null },
    userId?: string,
  ) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new Error("Harga paket tidak ditemukan");
    }

    const updated = await this.repository.update(
      id,
      sanitizeHargaPaketUpdateInput(data),
    );

    if (data.bandwidthId !== undefined) {
      await Promise.all([
        syncMikroTikRateLimit(updated),
        syncRadiusPackage({
          packageId: updated.id,
          radiusRepository: this.radiusRepository,
          errorMessage: "[HargaPaketService] RADIUS sync error during update:",
        }),
      ]);
    }

    if (userId) {
      logActivitySafe({
        action: "UPDATE",
        subject: "Harga Paket",
        userId,
        details: { id: updated.id, name: updated.name },
      });
    }

    return updated;
  }

  /**
   * Delete harga paket
   */
  async deleteHargaPaket(id: string, userId?: string) {
    // Check if exists
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new Error("Harga paket tidak ditemukan");
    }

    // Check if has pelanggan
    const pelangganCount = await this.repository.countPelangganByHargaPaket(id);
    if (pelangganCount > 0) {
      throw new Error(
        `Tidak dapat menghapus paket yang masih digunakan oleh ${pelangganCount} pelanggan`,
      );
    }

    await this.repository.delete(id);

    // Log activity
    if (userId) {
      logActivitySafe({
        action: "DELETE",
        subject: "Harga Paket",
        userId,
        details: { id, name: existing.name },
      });
    }

    return { success: true };
  }
}
