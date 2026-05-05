import type { PrismaClient } from "@prisma/client";

import { prisma as defaultPrisma } from "@/lib/prisma";
import { InventoryStockService } from "@/modules/inventory";
import { UserLookupService } from "@/modules/users";
import {
  TicketRepository,
  WorkOrderTemplateRepository,
  WarrantyCheckRepository,
} from "../repositories/WorkOrderSupportRepositories";
import { WorkOrderMaterialRepository } from "../repositories/WorkOrderMaterialRepository";
import { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import { WorkOrderActivityService } from "./WorkOrderActivityService";
import { WorkOrderMaterialService } from "./WorkOrderMaterialService";
import { WorkOrderMutationService } from "./WorkOrderMutationService";
import { WorkOrderReadService } from "./WorkOrderReadService";

export function buildWorkOrderServiceDependencies(prismaClient?: PrismaClient) {
  const client = prismaClient ?? defaultPrisma;
  const repository = new WorkOrderRepository(client);
  const materialRepository = new WorkOrderMaterialRepository(client);

  return {
    repository,
    activityService: new WorkOrderActivityService(repository),
    readService: new WorkOrderReadService(repository),
    materialService: buildWorkOrderMaterialService(
      client,
      repository,
      materialRepository,
    ),
    mutationService: buildWorkOrderMutationService(repository),
  };
}

function buildWorkOrderMaterialService(
  prismaClient: PrismaClient,
  repository: WorkOrderRepository,
  materialRepository: WorkOrderMaterialRepository,
) {
  return new WorkOrderMaterialService({
    prismaClient,
    repository,
    materialRepository,
    inventoryService: new InventoryStockService(),
  });
}

function buildWorkOrderMutationService(repository: WorkOrderRepository) {
  return new WorkOrderMutationService({
    repository,
    userRepo: new UserLookupService(),
    ticketRepo: new TicketRepository(),
    warrantyRepo: new WarrantyCheckRepository(),
  });
}

export function initializeWorkOrderTemplateRepository(): void {
  new WorkOrderTemplateRepository();
}
