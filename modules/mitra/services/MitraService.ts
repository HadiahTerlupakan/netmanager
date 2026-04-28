import { logger } from "@/lib/logger";
import { hash } from "bcryptjs";
import { randomUUID } from "crypto";
import { logActivitySafe } from "@/lib/logger";
import { checkGlobalIdentifier } from "@/lib/validations/global-identifier";
import type {
  CreateMitraDTO,
  MitraFilters,
  MitraWithDetails,
  UpdateMitraDTO,
} from "../dto/MitraDTO";
import type { IMitraRepository } from "../domain/ports/IMitraRepository";
import { toMitraDTO } from "../mappers/MitraMapper";
import { getMitraRepository } from "../repositories/MitraRepository";

interface ServiceResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

const HASH_ROUNDS = 12;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

export class MitraService {
  constructor(
    private readonly repository: IMitraRepository = getMitraRepository(),
  ) {}

  /** Mengambil daftar mitra beserta statistik sesuai filter. */
  async getMitras(
    filters: MitraFilters,
    page = DEFAULT_PAGE,
    limit = DEFAULT_LIMIT,
  ) {
    try {
      const [result, stats] = await Promise.all([
        this.repository.findAll(filters, page, limit),
        this.repository.getStats(filters.tenantId),
      ]);
      return {
        success: true,
        data: { ...result, mitras: result.mitras.map(toMitraDTO), stats },
      };
    } catch (error) {
      logger.error("[MitraService] Error fetching mitras:", error as Error);
      return { success: false, error: "Gagal mengambil data mitra" };
    }
  }

  /** Mengambil detail satu mitra berdasarkan id. */
  async getMitraById(
    id: string,
    tenantId?: string,
  ): Promise<ServiceResult<MitraWithDetails>> {
    try {
      const mitra = await this.repository.findById(id, tenantId);
      if (!mitra) return { success: false, error: "Mitra tidak ditemukan" };
      return { success: true, data: toMitraDTO(mitra) };
    } catch (error) {
      logger.error("[MitraService] Error fetching mitra:", error as Error);
      return { success: false, error: "Gagal mengambil data mitra" };
    }
  }

  /** Membuat mitra baru sekaligus wallet awalnya. */
  async createMitra(
    data: CreateMitraDTO,
    createdById: string,
  ): Promise<ServiceResult<{ id: string }>> {
    try {
      const emailError = await this.validateGlobalEmail(data.email);
      if (emailError) return emailError;
      const id = randomUUID();
      const passwordHash = await hash(data.password, HASH_ROUNDS);
      await this.repository.createMitra({ id, passwordHash, payload: data });
      this.logCreateActivity(createdById, id, data.name, data.employeeType);
      return { success: true, data: { id } };
    } catch (error) {
      logger.error("[MitraService] Error creating mitra:", error as Error);
      return { success: false, error: "Gagal membuat mitra" };
    }
  }

  /** Memperbarui data mitra yang ada. */
  async updateMitra(
    id: string,
    data: UpdateMitraDTO,
    updatedById: string,
  ): Promise<ServiceResult> {
    try {
      const existing = await this.repository.findByIdSimple(id, data.tenantId);
      if (!existing) return { success: false, error: "Mitra tidak ditemukan" };
      const emailError = await this.validateUpdatedEmail(
        data.email,
        existing.email,
      );
      if (emailError) return emailError;
      const passwordHash = await this.hashPasswordIfNeeded(data.password);
      await this.repository.updateMitra({ id, passwordHash, payload: data });
      this.logUpdateActivity(updatedById, id, data);
      return { success: true };
    } catch (error) {
      logger.error("[MitraService] Error updating mitra:", error as Error);
      return { success: false, error: "Gagal memperbarui mitra" };
    }
  }

  /** Menonaktifkan mitra secara soft delete. */
  async deleteMitra(
    id: string,
    deletedById: string,
    tenantId?: string,
  ): Promise<ServiceResult> {
    try {
      const existing = await this.repository.findByIdSimple(id, tenantId);
      if (!existing) return { success: false, error: "Mitra tidak ditemukan" };
      await this.repository.softDeleteMitra(id);
      logActivitySafe({
        action: "DELETE",
        subject: "Mitra",
        userId: deletedById,
        details: { mitraId: id, tenantId },
      });
      return { success: true };
    } catch (error) {
      logger.error("[MitraService] Error deleting mitra:", error as Error);
      return { success: false, error: "Gagal menghapus mitra" };
    }
  }

  /** Mengambil statistik agregat mitra. */
  async getStats(
    tenantId?: string,
  ): Promise<ServiceResult<Record<string, unknown>>> {
    try {
      const stats = await this.repository.getStats(tenantId);
      return {
        success: true,
        data: stats as unknown as Record<string, unknown>,
      };
    } catch (error) {
      logger.error("[MitraService] Error getting stats:", error as Error);
      return { success: false, error: "Gagal mengambil statistik mitra" };
    }
  }

  /** Mengambil log verifikasi wajah milik mitra. */
  async getFaceVerificationLogs(
    mitraId: string,
    tenantId?: string,
    page = DEFAULT_PAGE,
    limit = DEFAULT_LIMIT,
  ) {
    try {
      const mitra = await this.repository.findByIdSimple(mitraId, tenantId);
      if (!mitra) return { success: false, error: "Mitra tidak ditemukan" };
      const result = await this.repository.getFaceVerificationLogs(
        mitraId,
        page,
        limit,
      );
      return { success: true, data: result };
    } catch (error) {
      logger.error(
        "[MitraService] Error fetching face verification logs:",
        error as Error,
      );
      return {
        success: false,
        error: "Gagal mengambil history verifikasi wajah",
      };
    }
  }

  private async validateGlobalEmail(email: string) {
    const globalCheck = await checkGlobalIdentifier(email, "MITRA");
    if (!globalCheck.exists) return null;
    return {
      success: false,
      error: `Email sudah digunakan sebagai ${globalCheck.role}`,
    };
  }

  private async validateUpdatedEmail(
    nextEmail: string | undefined,
    currentEmail: string,
  ) {
    if (!nextEmail || nextEmail === currentEmail) return null;
    return this.validateGlobalEmail(nextEmail);
  }

  private async hashPasswordIfNeeded(password?: string) {
    if (!password) return undefined;
    return hash(password, HASH_ROUNDS);
  }

  private logCreateActivity(
    userId: string,
    mitraId: string,
    name: string,
    type: string,
  ) {
    logActivitySafe({
      action: "CREATE",
      subject: "Mitra",
      userId,
      details: { mitraId, name, type },
    });
  }

  private logUpdateActivity(
    userId: string,
    mitraId: string,
    changes: UpdateMitraDTO,
  ) {
    logActivitySafe({
      action: "UPDATE",
      subject: "Mitra",
      userId,
      details: { mitraId, changes },
    });
  }
}

let instance: MitraService | null = null;

export function getMitraService(): MitraService {
  if (!instance) {
    instance = new MitraService();
  }

  return instance;
}
