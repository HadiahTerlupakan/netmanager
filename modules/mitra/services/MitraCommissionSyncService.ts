import { logger } from "@/lib/logger";
import type { IMitraWalletRepository } from "../domain/ports/IMitraWalletRepository";
import { getMitraWalletRepository } from "../repositories/MitraWalletRepository";
import { validatePositiveAmount } from "../validators/mitraValidation";

interface SyncCommissionInput {
  mitraId: string;
  amount: number;
  description?: string;
  referenceId: string;
  tenantId?: string;
}

interface ServiceResult {
  success: boolean;
  error?: string;
  code?: "VALIDATION_ERROR" | "DUPLICATE" | "NOT_FOUND" | "INTERNAL_ERROR";
}

export class MitraCommissionSyncService {
  constructor(
    private readonly walletRepository: IMitraWalletRepository = getMitraWalletRepository(),
  ) {}

  /** Menyinkronkan komisi ke wallet mitra secara idempoten. */
  async syncCommission(input: SyncCommissionInput): Promise<ServiceResult> {
    try {
      const validationError = this.validateInput(input);
      if (validationError) return validationError;
      const tenantCheck = await this.assertMitraInTenant(input);
      if (tenantCheck) return tenantCheck;
      const existingTx =
        await this.walletRepository.findTransactionByReferenceId(
          input.referenceId,
        );
      if (existingTx) return this.buildDuplicateResult();
      await this.walletRepository.addEarning({
        userId: input.mitraId,
        amount: Number(input.amount),
        description: input.description || "",
        referenceId: input.referenceId,
      });
      return { success: true };
    } catch (error: unknown) {
      return this.handleSyncError(error);
    }
  }

  private validateInput(input: SyncCommissionInput): ServiceResult | null {
    if (!input.mitraId || !input.referenceId) {
      return {
        success: false,
        error: "Data tidak lengkap",
        code: "VALIDATION_ERROR",
      };
    }
    const amountError = validatePositiveAmount(Number(input.amount));
    if (amountError) {
      return { success: false, error: amountError, code: "VALIDATION_ERROR" };
    }
    return null;
  }

  private async assertMitraInTenant(
    input: SyncCommissionInput,
  ): Promise<ServiceResult | null> {
    if (!input.tenantId) return null;
    const mitra = await this.walletRepository.findMitraTypeById(
      input.mitraId,
      input.tenantId,
    );
    if (!mitra) {
      return {
        success: false,
        error: "Mitra tidak ditemukan",
        code: "NOT_FOUND",
      };
    }
    return null;
  }

  private buildDuplicateResult(): ServiceResult {
    return {
      success: false,
      error: "Komisi untuk invoice ini sudah pernah disinkronisasi sebelumnya.",
      code: "DUPLICATE",
    };
  }

  private handleSyncError(error: unknown): ServiceResult {
    logger.error("Sync Commission error:", error as Error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const code =
      message === "Wallet mitra tidak ditemukan"
        ? "NOT_FOUND"
        : "INTERNAL_ERROR";
    return { success: false, error: message, code };
  }
}

let mitraCommissionSyncServiceInstance: MitraCommissionSyncService | null =
  null;

export function getMitraCommissionSyncService(): MitraCommissionSyncService {
  if (!mitraCommissionSyncServiceInstance) {
    mitraCommissionSyncServiceInstance = new MitraCommissionSyncService();
  }

  return mitraCommissionSyncServiceInstance;
}
