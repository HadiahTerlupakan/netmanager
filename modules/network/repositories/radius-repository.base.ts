import { prismaRadius } from "@/lib/prisma-radius";
import type { prisma as defaultPrisma } from "@/lib/prisma";

import { RadiusRepositoryResourcesBase } from "./radius-repository-resources.base";

type PrismaInstance = typeof defaultPrisma;

export abstract class RadiusRepositoryBase extends RadiusRepositoryResourcesBase {
  constructor(
    protected override prisma: PrismaInstance,
    radiusClient?: typeof prismaRadius,
  ) {
    super(prisma, radiusClient);
  }
}

export default RadiusRepositoryBase;
