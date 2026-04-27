import { logger } from "@/lib/logger";
import type { IMitraWalletRepository } from "../domain/ports/IMitraWalletRepository";
import { getMitraWalletRepository } from "../repositories/MitraWalletRepository";

interface SyncCommissionInput {
  mitraId: string;
  amount: number;
  description?: string;
  referenceId: string;
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
    if (input.mitraId && input.amount && input.referenceId) return null;
    return {
      success: false,
      error: "Data tidak lengkap",
      code: "VALIDATION_ERROR",
    };
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
