/**
 * AssetFactory
 *
 * Factory pattern for creating Asset with different configurations.
 */

import type { AssetStatus } from "@prisma/client";

import { generateAssetCode } from "../utils/asset-code";

export interface CreateAssetInput {
  barangId: string;
  kodeAsset: string;
  purchaseDate: Date;
  purchasePrice: number;
  currentValue: number;
  residualValue: number;
  usefulLife: number;
  status: AssetStatus;
  location?: string;
  assignedTo?: string;
}

export class AssetFactory {
  /**
   * Create new asset from purchase
   */
  static createFromPurchase(dto: {
    barangId: string;
    kodeAsset: string;
    purchasePrice: number;
    usefulLife: number;
    residualValue?: number;
    location?: string;
  }): CreateAssetInput {
    return {
      barangId: dto.barangId,
      kodeAsset: dto.kodeAsset,
      purchaseDate: new Date(),
      purchasePrice: dto.purchasePrice,
      currentValue: dto.purchasePrice, // Start with purchase price
      residualValue: dto.residualValue ?? 0,
      usefulLife: dto.usefulLife,
      status: "ACTIVE",
      location: dto.location,
    };
  }

  /**
   * Create asset for installation (assigned to customer/location)
   */
  static createForInstallation(dto: {
    barangId: string;
    kodeAsset: string;
    purchasePrice: number;
    usefulLife: number;
    location: string;
    assignedTo?: string;
  }): CreateAssetInput {
    return {
      barangId: dto.barangId,
      kodeAsset: dto.kodeAsset,
      purchaseDate: new Date(),
      purchasePrice: dto.purchasePrice,
      currentValue: dto.purchasePrice,
      residualValue: 0,
      usefulLife: dto.usefulLife,
      status: "INSTALLED",
      location: dto.location,
      assignedTo: dto.assignedTo,
    };
  }

  /**
   * Create asset in storage/warehouse
   */
  static createInStorage(dto: {
    barangId: string;
    kodeAsset: string;
    purchasePrice: number;
    usefulLife: number;
    warehouseLocation: string;
  }): CreateAssetInput {
    return {
      barangId: dto.barangId,
      kodeAsset: dto.kodeAsset,
      purchaseDate: new Date(),
      purchasePrice: dto.purchasePrice,
      currentValue: dto.purchasePrice,
      residualValue: 0,
      usefulLife: dto.usefulLife,
      status: "ACTIVE",
      location: dto.warehouseLocation,
    };
  }

  /**
   * Create asset for employee assignment
   */
  static createForEmployee(dto: {
    barangId: string;
    kodeAsset: string;
    purchasePrice: number;
    usefulLife: number;
    employeeId: string;
    employeeName: string;
  }): CreateAssetInput {
    return {
      barangId: dto.barangId,
      kodeAsset: dto.kodeAsset,
      purchaseDate: new Date(),
      purchasePrice: dto.purchasePrice,
      currentValue: dto.purchasePrice,
      residualValue: 0,
      usefulLife: dto.usefulLife,
      status: "ACTIVE",
      location: `Assigned to: ${dto.employeeName}`,
      assignedTo: dto.employeeId,
    };
  }

  /**
   * Generate unique asset code
   */
  static generateAssetCode(prefix: string = "AST"): string {
    return generateAssetCode(prefix);
  }

  /**
   * Calculate monthly depreciation amount
   */
  static calculateMonthlyDepreciation(
    purchasePrice: number,
    residualValue: number,
    usefulLifeMonths: number,
  ): number {
    if (usefulLifeMonths <= 0) return 0;
    return (purchasePrice - residualValue) / usefulLifeMonths;
  }
}
