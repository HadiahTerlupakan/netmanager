import { prisma } from "@/modules/database";
import type { FeatureModuleCode } from "@/lib/feature-modules";
import type {
  IFeatureFlagRepository,
  TenantFeatureFlagRow,
} from "../domain/ports/IFeatureFlagRepository";

const SELECT_ROW = {
  feature: true,
  enabled: true,
  updatedBy: true,
  updatedAt: true,
} as const;

export class FeatureFlagRepository implements IFeatureFlagRepository {
  async findAllByTenant(tenantId: string): Promise<TenantFeatureFlagRow[]> {
    return prisma.tenantFeatureFlag.findMany({
      where: { tenantId },
      select: SELECT_ROW,
    });
  }

  async findByFeature(
    tenantId: string,
    feature: FeatureModuleCode,
  ): Promise<TenantFeatureFlagRow | null> {
    return prisma.tenantFeatureFlag.findUnique({
      where: { tenantId_feature: { tenantId, feature } },
      select: SELECT_ROW,
    });
  }

  async upsert(
    tenantId: string,
    feature: FeatureModuleCode,
    enabled: boolean,
    updatedBy: string | null,
  ): Promise<TenantFeatureFlagRow> {
    return prisma.tenantFeatureFlag.upsert({
      where: { tenantId_feature: { tenantId, feature } },
      create: { tenantId, feature, enabled, updatedBy },
      update: { enabled, updatedBy },
      select: SELECT_ROW,
    });
  }
}
