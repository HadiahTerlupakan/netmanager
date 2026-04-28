import { logger } from "@/lib/logger";
/**
 * USORepository - DISABLED
 *
 * This repository is disabled because the USOContribution and Pemasukan
 * Prisma models do not exist in the current schema.
 *
 * To enable this repository:
 * 1. Add the USOContribution model to prisma/schema.prisma
 * 2. Add the Pemasukan model to prisma/schema.prisma
 * 3. Run `npx prisma generate`
 * 4. Uncomment the code below
 */

import type { PrismaClient } from "@prisma/client";
import type {
  IUSORepository,
  USOContributionDTO,
  CreateUSODTO,
} from "./IUSORepository";

export class USORepository implements IUSORepository {
  constructor(_prismaClient: PrismaClient) {
    // Disabled - model does not exist
  }

  async findAll(_filters?: {
    year?: number;
    status?: string;
    quarter?: number;
  }): Promise<USOContributionDTO[]> {
    logger.warn(
      "[USORepository] findAll: Model USOContribution does not exist",
    );
    return [];
  }

  async findById(_id: string): Promise<USOContributionDTO | null> {
    logger.warn(
      "[USORepository] findById: Model USOContribution does not exist",
    );
    return null;
  }

  async findByQuarter(
    _quarter: number,

    _year: number,
  ): Promise<USOContributionDTO | null> {
    logger.warn(
      "[USORepository] findByQuarter: Model USOContribution does not exist",
    );
    return null;
  }

  async create(_data: CreateUSODTO): Promise<USOContributionDTO> {
    throw new Error(
      "USORepository: Model USOContribution does not exist in schema",
    );
  }

  async update(
    _id: string,

    _data: Partial<USOContributionDTO>,
  ): Promise<USOContributionDTO> {
    throw new Error(
      "USORepository: Model USOContribution does not exist in schema",
    );
  }

  async delete(_id: string): Promise<void> {
    logger.warn("[USORepository] delete: Model USOContribution does not exist");
  }

  async markAsFiled(
    _id: string,
    _filedBy: string,
  ): Promise<USOContributionDTO> {
    throw new Error(
      "USORepository: Model USOContribution does not exist in schema",
    );
  }

  async markAsPaid(
    _id: string,

    _paidBy: string,

    _paymentReference?: string,
  ): Promise<USOContributionDTO> {
    throw new Error(
      "USORepository: Model USOContribution does not exist in schema",
    );
  }

  async calculateForQuarter(
    _quarter: number,

    _year: number,

    _createdBy?: string,
  ): Promise<USOContributionDTO> {
    throw new Error(
      "USORepository: Model USOContribution does not exist in schema",
    );
  }

  async getQuarterlyRevenue(
    _quarter: number,

    _year: number,
  ): Promise<bigint> {
    logger.warn(
      "[USORepository] getQuarterlyRevenue: Model Pemasukan does not exist",
    );
    return BigInt(0);
  }
}
