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

      if (!asset) throw new Error("Asset not found");

      if (asset.status !== "ACTIVE" && asset.status !== "INSTALLED") {
        throw new Error(`Asset status is ${asset.status}, cannot depreciate.`);
      }

      if (asset.currentValue.toNumber() <= asset.residualValue.toNumber()) {
        return null; // No depreciation needed, already at residual value
      }

      // Calculation: Straight Line
      // (Cost - Residual) / UsefulLife
      const cost = asset.purchasePrice.toNumber();
      const residual = asset.residualValue.toNumber();
      const lifeMonths = asset.usefulLife;

      if (lifeMonths <= 0) throw new Error("Useful life must be > 0");

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
        throw new Error(
          'Expense Category for Depreciation (e.g. "Beban Penyusutan") not found. Please create it in Finance Settings.',
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
