import { prismaBilling } from "@/lib/prisma-billing";

import { IntegrationMapper } from "../mappers/IntegrationMapper";
import type {
  IMixRadiusOwnerGroupRepository,
  MixRadiusOwnerGroupPayload,
  MixRadiusOwnerGroupUpdatePayload,
} from "../domain/ports/IMixRadiusOwnerGroupRepository";

export class MixRadiusOwnerGroupRepository implements IMixRadiusOwnerGroupRepository {
  /** Get owner groups with optional tenant filter. */
  async getOwnerGroups(tenantId?: string) {
    const models = await prismaBilling.mixRadiusOwnerGroup.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { name: "asc" },
    });

    return models.map((model) => IntegrationMapper.toOwnerGroupDomain(model));
  }

  /** Get a single owner group. */
  async getOwnerGroup(id: string, tenantId?: string) {
    const model = await prismaBilling.mixRadiusOwnerGroup.findUnique({
      where: tenantId ? { id, tenantId } : { id },
    });

    return model ? IntegrationMapper.toOwnerGroupDomain(model) : null;
  }

  /** Create a new owner group. */
  async createOwnerGroup(data: MixRadiusOwnerGroupPayload) {
    const model = await prismaBilling.mixRadiusOwnerGroup.create({ data });
    return IntegrationMapper.toOwnerGroupDomain(model);
  }

  /** Update an owner group. */
  async updateOwnerGroup(id: string, data: MixRadiusOwnerGroupUpdatePayload) {
    const { tenantId, ...updateData } = data;
    const model = await prismaBilling.mixRadiusOwnerGroup.update({
      where: tenantId ? { id, tenantId } : { id },
      data: updateData,
    });

    return IntegrationMapper.toOwnerGroupDomain(model);
  }

  /** Delete an owner group. */
  async deleteOwnerGroup(id: string, tenantId?: string) {
    const model = await prismaBilling.mixRadiusOwnerGroup.delete({
      where: tenantId ? { id, tenantId } : { id },
    });

    return IntegrationMapper.toOwnerGroupDomain(model);
  }
}
