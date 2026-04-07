import { prismaMitra } from "@/modules/database";
import { logger } from "@/lib/logger";

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
  async syncCommission(input: SyncCommissionInput): Promise<ServiceResult> {
    try {
      if (!input.mitraId || !input.amount || !input.referenceId) {
        return {
          success: false,
          error: "Data tidak lengkap",
          code: "VALIDATION_ERROR",
        };
      }

      const existingTx = await prismaMitra.mitraTransaction.findFirst({
        where: { referenceId: input.referenceId },
      });

      if (existingTx) {
        return {
          success: false,
          error:
            "Komisi untuk invoice ini sudah pernah disinkronisasi sebelumnya.",
          code: "DUPLICATE",
        };
      }

      await prismaMitra.$transaction(async (tx) => {
        const wallet = await tx.mitraWallet.findFirst({
          where: { mitraId: input.mitraId },
        });

        if (!wallet) {
          throw new Error("Wallet mitra tidak ditemukan");
        }

        await tx.mitraTransaction.create({
          data: {
            walletId: wallet.id,
            type: "EARNING",
            amount: Number(input.amount),
            description: input.description,
            referenceId: input.referenceId,
          },
        });

        await tx.mitraWallet.update({
          where: { id: wallet.id },
          data: {
            balance: { increment: Number(input.amount) },
            totalEarnings: { increment: Number(input.amount) },
          },
        });
      });

      return { success: true };
    } catch (error: unknown) {
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
}

let mitraCommissionSyncServiceInstance: MitraCommissionSyncService | null =
  null;

export function getMitraCommissionSyncService(): MitraCommissionSyncService {
  if (!mitraCommissionSyncServiceInstance) {
    mitraCommissionSyncServiceInstance = new MitraCommissionSyncService();
  }

  return mitraCommissionSyncServiceInstance;
}
