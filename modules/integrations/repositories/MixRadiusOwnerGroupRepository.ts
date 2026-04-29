import { prismaBilling } from "@/lib/prisma-billing";
import type { IMixRadiusOwnerGroupRepository } from "../domain/ports/IMixRadiusOwnerGroupRepository";

export type OwnerNameLookup = {
  full: string;
  prefix: string;
};

/**
 * Repository for MixRadius owner-group persistence queries.
 */
export class MixRadiusOwnerGroupRepository implements IMixRadiusOwnerGroupRepository {
  /**
   * Get owner groups ordered by name.
   */
  async findMany(tenantId?: string) {
    return prismaBilling.mixRadiusOwnerGroup.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { name: "asc" },
    });
  }

  /**
   * Get owner group by identifier.
   */
  async findById(id: string, tenantId?: string) {
    return prismaBilling.mixRadiusOwnerGroup.findUnique({
      where: tenantId ? { id, tenantId } : { id },
    });
  }

  /**
   * Create a new owner group.
   */
  async create(data: {
    name: string;
    owners: string[];
    siteId?: string;
    isActive?: boolean;
    tenantId?: string;
  }) {
    return prismaBilling.mixRadiusOwnerGroup.create({ data });
  }

  /**
   * Update an owner group.
   */
  async update(
    id: string,
    tenantId: string | undefined,
    data: {
      name?: string;
      owners?: string[];
      siteId?: string;
      isActive?: boolean;
    },
  ) {
    return prismaBilling.mixRadiusOwnerGroup.update({
      where: tenantId ? { id, tenantId } : { id },
      data,
    });
  }

  /**
   * Delete an owner group.
   */
  async delete(id: string, tenantId?: string) {
    return prismaBilling.mixRadiusOwnerGroup.delete({
      where: tenantId ? { id, tenantId } : { id },
    });
  }

  /**
   * Get owner names by site.
   */
  async findOwnersBySiteId(siteId: string): Promise<string[]> {
    const groups = await prismaBilling.mixRadiusOwnerGroup.findMany({
      where: { siteId },
      select: { owners: true },
    });

    return groups.flatMap((group) => group.owners);
  }

  /**
   * Get owner names by group id.
   */
  async findOwnersByGroupId(groupId: string): Promise<string[] | null> {
    const group = await prismaBilling.mixRadiusOwnerGroup.findUnique({
      where: { id: groupId },
      select: { owners: true },
    });

    return group?.owners ?? null;
  }
}

export const mixRadiusOwnerGroupRepository =
  new MixRadiusOwnerGroupRepository();
