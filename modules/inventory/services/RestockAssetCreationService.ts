import { Prisma } from "@prisma/client";

const DEFAULT_ASSET_USEFUL_LIFE = 48;
const VEHICLE_ASSET_USEFUL_LIFE = 96;
const BUILDING_ASSET_USEFUL_LIFE = 240;
const FURNITURE_ASSET_USEFUL_LIFE = 96;
const ONE_DAY_OFFSET = 1;
const ASSET_CODE_SLICE_START = 2;
const ASSET_CODE_SLICE_END = 7;
const TIMESTAMP_SUFFIX_LENGTH = 6;
const ASSET_SEQUENCE_PAD_LENGTH = 2;

type TransactionClient = Prisma.TransactionClient;

interface AssetCreationInput {
  barangId: string;
  barangKode: string;
  kategoriAset: string | null;
  unitPrice: number;
  quantity: number;
  location: string;
  timestamp: Date;
}

export class RestockAssetCreationService {
  /** Buat asset tetap dari penerimaan barang aset. */
  async createAssetsForStockIn(
    transaction: TransactionClient,
    input: AssetCreationInput,
  ) {
    const assets = this.buildAssetPayloads(input);
    if (assets.length === 0) return;
    await transaction.asset.createMany({
      data: assets.map((asset) => ({ id: crypto.randomUUID(), ...asset })),
    });
  }

  private buildAssetPayloads(input: AssetCreationInput) {
    const usefulLife = this.getUsefulLifeMonths(input.kategoriAset);
    const prefix = `AST-${input.barangKode}`;
    const dateCode = input.timestamp
      .toISOString()
      .slice(ASSET_CODE_SLICE_START, ASSET_CODE_SLICE_END)
      .replace("-", "");
    const timestampSuffix = Date.now()
      .toString()
      .slice(-TIMESTAMP_SUFFIX_LENGTH);
    return Array.from({ length: input.quantity }, (_, index) => ({
      barangId: input.barangId,
      kodeAsset: `${prefix}-${dateCode}-${timestampSuffix}${String(index + ONE_DAY_OFFSET).padStart(ASSET_SEQUENCE_PAD_LENGTH, "0")}`,
      purchaseDate: input.timestamp,
      purchasePrice: input.unitPrice,
      currentValue: input.unitPrice,
      usefulLife,
      residualValue: 0,
      status: "ACTIVE" as const,
      location: input.location,
      assignedTo: null as string | null,
    }));
  }

  private getUsefulLifeMonths(kategoriAset: string | null) {
    if (kategoriAset === "KENDARAAN") return VEHICLE_ASSET_USEFUL_LIFE;
    if (kategoriAset === "BANGUNAN") return BUILDING_ASSET_USEFUL_LIFE;
    if (kategoriAset === "FURNITURE") return FURNITURE_ASSET_USEFUL_LIFE;
    return DEFAULT_ASSET_USEFUL_LIFE;
  }
}
