import { logger } from "@/lib/logger";
import { AssetRepository } from "../repositories/AssetRepository";
import type {
  CreateAssetInput,
  UpdateAssetInput,
  AssetWithRelations,
} from "../repositories/AssetRepository";
import { AssetStatus } from "../types/asset.enums";
import { logActivitySafe } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  LABEL_STATUS_ASET,
  type AssetStatusValue,
} from "../validators/assetValidator";
import {
  isPrismaError,
  pesanTidakDitemukan,
  translateMasterDataError,
  type MasterDataErrorTranslation,
  type MasterDataFailure,
} from "./inventory-master-data-errors";

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;

/** Aturan aset dilanggar; `message` sudah siap dibaca staf. */
export class AssetRuleError extends Error {
  constructor(
    message: string,
    readonly status: number = HTTP_BAD_REQUEST,
  ) {
    super(message);
    this.name = "AssetRuleError";
  }
}

const ASSET_ERRORS: readonly MasterDataErrorTranslation[] = [
  {
    matches: isPrismaError("P2002"),
    status: HTTP_CONFLICT,
    message: "Kode aset itu sudah dipakai aset lain. Pakai kode lain.",
  },
  {
    matches: isPrismaError("P2003"),
    status: HTTP_BAD_REQUEST,
    message:
      "Barang yang dipilih untuk aset ini tidak ditemukan. Mungkin sudah dihapus. Muat ulang halaman, lalu pilih barangnya lagi.",
  },
  {
    matches: isPrismaError("P2025"),
    status: HTTP_NOT_FOUND,
    message: pesanTidakDitemukan("Aset"),
  },
];

/**
 * Terjemahkan error dari operasi aset menjadi pesan staf. Error yang tidak
 * dikenali dicatat ke log dan staf menerima `fallback.message`.
 */
export function translateAssetError(
  error: unknown,
  fallback: { message: string; logContext: string },
): MasterDataFailure {
  if (error instanceof AssetRuleError) {
    return { success: false, status: error.status, error: error.message };
  }
  return translateMasterDataError(error, ASSET_ERRORS, fallback);
}

function labelStatusAset(status: string): string {
  return LABEL_STATUS_ASET[status as AssetStatusValue] ?? status;
}

export class AssetService {
  private assetRepo: AssetRepository;

  constructor() {
    this.assetRepo = new AssetRepository();
  }

  async createAsset(data: CreateAssetInput, userId: string) {
    // Create the asset
    const asset = await this.assetRepo.createAsset(data);

    // Log Activity
    logActivitySafe({
      action: "CREATE",
      subject: "Asset",
      userId: userId,
      details: {
        id: asset.id,
        kodeAsset: asset.kodeAsset,
        barangId: asset.barangId,
        purchasePrice: asset.purchasePrice,
        status: asset.status,
      },
    });

    // Note: Initial Purchase expense is usually handled via Purchase Order / Finance separately
    // so we don't auto-create transaction here unless explicitly requested.
    // But we DO expect this asset to be capitalized.

    return asset;
  }

  async getAsset(id: string): Promise<AssetWithRelations | null> {
    return this.assetRepo.findAssetById(id);
  }

  async updateAsset(id: string, data: UpdateAssetInput, userId?: string) {
    const result = await this.assetRepo.updateAsset(id, data);

    // Log Activity
    if (userId) {
      logActivitySafe({
        action: "UPDATE",
        subject: "Asset",
        userId: userId,
        details: {
          id: result.id,
          kodeAsset: result.kodeAsset,
          updates: data,
        },
      });
    }

    return result;
  }

  async findAllAssets(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: AssetStatus;
    barangId?: string;
    location?: string;
  }) {
    const { page = 1, limit = 10, ...rest } = params;
    const skip = (page - 1) * limit;
    return this.assetRepo.findAllAssets({
      skip,
      take: limit,
      ...rest,
    });
  }

  /**
   * Calculates and processes monthly depreciation for a single asset.
   * Use this for ad-hoc or scheduled runs per asset.
   */
  async depreciateAsset(
    assetId: string,
    customDate: Date = new Date(),
    createdById: string,
  ) {
    const result = await prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findUnique({
        where: { id: assetId },
        include: { barang: true },
      });

      if (!asset) {
        throw new AssetRuleError(pesanTidakDitemukan("Aset"), HTTP_NOT_FOUND);
      }

      if (asset.status !== "ACTIVE" && asset.status !== "INSTALLED") {
        throw new AssetRuleError(
          `Aset "${asset.kodeAsset}" berstatus ${labelStatusAset(asset.status)}, jadi tidak bisa disusutkan. Penyusutan hanya untuk aset yang Aktif atau Terpasang.`,
        );
      }

      if (asset.currentValue.toNumber() <= asset.residualValue.toNumber()) {
        return null; // No depreciation needed, already at residual value
      }

      // Calculation: Straight Line
      // (Cost - Residual) / UsefulLife
      const cost = asset.purchasePrice.toNumber();
      const residual = asset.residualValue.toNumber();
      const lifeMonths = asset.usefulLife;

      if (lifeMonths <= 0) {
        throw new AssetRuleError(
          `Umur pakai aset "${asset.kodeAsset}" masih 0 bulan, jadi penyusutannya tidak bisa dihitung. Isi umur pakainya dulu di data aset.`,
        );
      }

      const monthlyAmount = (cost - residual) / lifeMonths;

      // Check if remaining value < monthlyAmount
      let actualAmount = monthlyAmount;
      const currentVal = asset.currentValue.toNumber();

      // Ensure we don't go below residual
      if (currentVal - monthlyAmount < residual) {
        actualAmount = currentVal - residual;
      }

      if (actualAmount <= 0) return null;

      // Find depreciation expense category first so we can fail before mutating the asset.
      const depCategory = await tx.expenseCategory.findFirst({
        where: {
          tenantId: asset.tenantId,
          OR: [
            { name: { contains: "penyusutan", mode: "insensitive" } },
            { name: { contains: "depreciation", mode: "insensitive" } },
          ],
        },
      });

      if (!depCategory) {
        throw new AssetRuleError(
          'Kategori biaya "Beban Penyusutan" belum dibuat, jadi penyusutan belum bisa dicatat. Minta admin keuangan membuatnya di Pengaturan Keuangan, lalu coba lagi.',
        );
      }

      await tx.expense.create({
        data: {
          id: crypto.randomUUID(),
          amount: BigInt(Math.round(actualAmount)),
          depreciation: BigInt(Math.round(actualAmount)),
          usefulLife: 0,
          date: customDate,
          category: "Depresiasi Aset",
          expenseCategory: { connect: { id: depCategory.id } },
          description: `Penyusutan Aset: ${asset.barang.nama} (${asset.kodeAsset})`,
          user: { connect: { id: createdById } },
          updatedAt: new Date(),
        },
      });

      // 1. Record in Asset Log & Update Asset Value
      const log = await tx.assetDepreciationLog.create({
        data: {
          id: crypto.randomUUID(),
          assetId: asset.id,
          amount: actualAmount,
          notes: `Depreciation for ${customDate.toLocaleString("default", { month: "long", year: "numeric" })}`,
          date: new Date(),
        },
      });

      await tx.asset.update({
        where: { id: asset.id },
        data: {
          currentValue: { decrement: actualAmount },
        },
      });

      return {
        log,
        asset: {
          id: asset.id,
          kodeAsset: asset.kodeAsset,
          amount: actualAmount,
          period: customDate.toISOString(),
        },
      };
    });

    if (result?.asset) {
      logActivitySafe({
        action: "DEPRECIATE",
        subject: "Asset",
        userId: createdById,
        details: result.asset,
      });
    }

    return result?.log ?? null;
  }

  /**
   * Run monthly depreciation for ALL active assets.
   * To be called by Cron Job.
   */
  async runMonthlyDepreciationCycle(createdById: string) {
    const assets = await this.assetRepo.getActiveAssetsForDepreciation();
    const results = [];

    for (const asset of assets) {
      try {
        const res = await this.depreciateAsset(
          asset.id,
          new Date(),
          createdById,
        );
        if (res) results.push(res);
      } catch (error) {
        logger.error(`Failed to depreciate asset ${asset.kodeAsset}:`, error);
        // Continue to next asset
      }
    }
    return results;
  }
}
