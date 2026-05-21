import type { RegionalMinimumWage } from "../entities/RegionalMinimumWage";

export interface IRegionalMinimumWageRepository {
  findByRegionAndYear(
    regionCode: string,
    year: number,
    tenantId: string,
  ): Promise<RegionalMinimumWage | null>;
  findAll(tenantId: string): Promise<RegionalMinimumWage[]>;
  create(
    data: Omit<RegionalMinimumWage, "id" | "createdAt" | "updatedAt">,
  ): Promise<RegionalMinimumWage>;
  update(
    id: string,
    tenantId: string,
    data: Partial<RegionalMinimumWage>,
  ): Promise<RegionalMinimumWage>;
  delete(id: string, tenantId: string): Promise<void>;
}
