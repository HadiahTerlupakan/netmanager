import { logger } from "@/lib/logger";
import { RadiusRepository } from "../repositories/RadiusRepository";
import { HargaPaketRepository } from "../repositories/HargaPaketRepository";
import type {
  HargaPaketCreateInput,
  HargaPaketUpdateInput,
  HargaPaketFilterOptions,
} from "../repositories/HargaPaketRepository";
import { hargaPaketSchema } from "@/lib/validations/hargapaket";
import { sanitizeInput } from "@/lib/utils/sanitize";
import { logActivitySafe } from "@/lib/logger";
import * as z from "zod";

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
    // Sanitize input
    const sanitizedData = {
      ...data,
      name: data.name ? sanitizeInput(data.name) : undefined,
      bandwidthId:
        data.bandwidthId && data.bandwidthId.trim()
          ? data.bandwidthId
          : undefined,
      description: data.description
        ? sanitizeInput(data.description)
        : undefined,
    };

    // Validate
    const validation = hargaPaketSchema.safeParse(sanitizedData);
    if (!validation.success) {
      throw {
        code: "VALIDATION_ERROR",
        message: "Validasi gagal",
        details: z.flattenError(validation.error),
      };
    }

    const validData = validation.data;

    const hargaPaket = await this.repository.create({
      name: validData.name,
      harga: validData.harga,
      durasi: validData.durasi,
      ...(validData.durasiUnit ? { durasiUnit: validData.durasiUnit } : {}),
      profilePPPId: validData.profilePPPId,
      ...(validData.siteId ? { siteId: validData.siteId } : {}),
      ...(validData.bandwidthId ? { bandwidthId: validData.bandwidthId } : {}),
      ...(validData.description ? { description: validData.description } : {}),
      ...(validData.featured !== undefined
        ? { featured: validData.featured }
        : {}),
      ...(validData.status ? { status: validData.status } : {}),
      ...(validData.usePPN !== undefined ? { usePPN: validData.usePPN } : {}),
      ...(validData.ppnPercentage !== undefined
        ? { ppnPercentage: validData.ppnPercentage }
        : {}),
      ...(validData.useDiscount !== undefined
        ? { useDiscount: validData.useDiscount }
        : {}),
      ...(validData.discountType !== undefined
        ? { discountType: validData.discountType }
        : {}),
      ...(validData.discountValue !== undefined
        ? { discountValue: validData.discountValue }
        : {}),
      ...(validData.discountDuration !== undefined
        ? { discountDuration: validData.discountDuration }
        : {}),
      ...(validData.discountDurationUnit !== undefined
        ? { discountDurationUnit: validData.discountDurationUnit }
        : {}),
      tenantId: data.tenantId,
    });

    // Sync MikroTik rate limit if needed
    await this.syncMikroTikRateLimit(hargaPaket);

    await this.syncRadiusPackage(
      hargaPaket.id,
      "[HargaPaketService] RADIUS sync error:",
    );

    // Log activity
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
    // Validate exists
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new Error("Harga paket tidak ditemukan");
    }

    // Sanitize
    const sanitizedData: HargaPaketUpdateInput = {};
    if (data.name !== undefined) sanitizedData.name = sanitizeInput(data.name);
    if (data.harga !== undefined) sanitizedData.harga = data.harga;
    if (data.durasi !== undefined) sanitizedData.durasi = data.durasi;
    if (data.durasiUnit !== undefined)
      sanitizedData.durasiUnit = data.durasiUnit;
    if (data.profilePPPId !== undefined)
      sanitizedData.profilePPPId = data.profilePPPId;
    if (data.description !== undefined)
      sanitizedData.description = sanitizeInput(data.description);
    if (data.featured !== undefined) sanitizedData.featured = data.featured;
    if (data.status !== undefined) sanitizedData.status = data.status;
    if (data.tenantId !== undefined) sanitizedData.tenantId = data.tenantId;

    // Handle site - can be null to disconnect
    if (data.siteId === null || data.siteId === "") {
      sanitizedData.siteId = null;
    } else if (data.siteId) {
      sanitizedData.siteId = data.siteId;
    }

    // Handle bandwidth - can be null to disconnect
    if (data.bandwidthId === null || data.bandwidthId === "") {
      sanitizedData.bandwidthId = null;
    } else if (data.bandwidthId) {
      sanitizedData.bandwidthId = data.bandwidthId;
    }

    const updated = await this.repository.update(id, sanitizedData);

    // Sync MikroTik if bandwidth changed
    if (data.bandwidthId !== undefined) {
      await this.syncMikroTikRateLimit(updated);

      await this.syncRadiusPackage(
        updated.id,
        "[HargaPaketService] RADIUS sync error during update:",
      );
    }

    // Log activity
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

  /** Sinkronkan paket ke RADIUS saat mode aktif. */
  private async syncRadiusPackage(packageId: string, errorMessage: string) {
    try {
      const { RadiusSyncService } = await import("./radius-sync-service");
      const radiusSync = new RadiusSyncService();
      const mode = await radiusSync.getConnectionMode();
      if (mode === "RADIUS") {
        await this.radiusRepository.syncPackageToRadius(packageId);
      }
    } catch (error) {
      logger.error(errorMessage, error);
    }
  }

  /**
   * Sync rate limit to MikroTik PPP profile
   */
  private async syncMikroTikRateLimit(hargaPaket: {
    id: string;
    name: string;
    profilePPPId: string;
    profilePPP?: {
      id: string;
      name: string;
      poolMode: string | null;
      mikroTikRouterId: string | null;
      mikroTikRouter?: unknown;
    };
  }) {
    // Jika tidak ada router, abaikan
    if (
      !hargaPaket.profilePPP?.mikroTikRouterId ||
      !hargaPaket.profilePPP?.mikroTikRouter
    ) {
      return;
    }

    try {
      const { RadiusSyncService } = await import("./radius-sync-service");
      const radiusSync = new RadiusSyncService();
      const connectionMode = await radiusSync.getConnectionMode();

      // Jika mode RADIUS dan poolMode profil adalah RADIUS,
      // maka rate limit dikelola oleh RADIUS, jangan kirim ke MikroTik
      if (
        connectionMode === "RADIUS" &&
        hargaPaket.profilePPP.poolMode === "RADIUS"
      ) {
        return;
      }

      const { getRateLimitFromBandwidth, updatePPPProfileInMikroTik } =
        await import("./mikrotik-ppp-profile");
      const rateLimit = await getRateLimitFromBandwidth(
        hargaPaket.profilePPP.id,
      );

      if (rateLimit) {
        const updateResult = await updatePPPProfileInMikroTik(
          hargaPaket.profilePPP.mikroTikRouterId,
          hargaPaket.profilePPP.name,
          {
            rateLimit,
            skipPoolCheck: hargaPaket.profilePPP.poolMode === "RADIUS",
          },
        );

        if (!updateResult.success) {
          logger.error(
            "[HargaPaketService] Failed to update rate limit:",
            updateResult.error,
          );
        }
      }
    } catch (error: unknown) {
      logger.error("[HargaPaketService] Error syncing MikroTik:", error);
    }
  }
}
