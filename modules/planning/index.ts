/**
 * Planning Module Public API (Server-Safe)
 *
 * Export public services, DTOs, validators, mappers, dan repositories.
 * File ini aman di-import dari server-side (API routes, server components).
 *
 * Client components WAJIB import dari "@/modules/planning/client" —
 * bukan dari barrel ini — untuk menghindari Prisma/pg/tls masuk ke
 * client bundle (Next.js build akan fail).
 */

// Services (server-only — import repositories yang pakai Prisma)
export {
  planningService,
  planningItemService,
  planningMilestoneService,
  planningApprovalService,
  planningTemplateService,
  planningAuditService,
  planningKanbanService,
  planningDashboardService,
} from "./services/PlanningServiceFactory";

// Repository factories (server-only — Prisma dependency)
import { PlanningRepository } from "./repositories/PlanningRepository";
import { PlanningItemRepository } from "./repositories/PlanningItemRepository";
import { PlanningMilestoneRepository } from "./repositories/PlanningMilestoneRepository";
import { PlanningDocumentRepository } from "./repositories/PlanningDocumentRepository";

export function getPlanningRepository(): PlanningRepository {
  return new PlanningRepository();
}

export function getPlanningItemRepository(): PlanningItemRepository {
  return new PlanningItemRepository();
}

export function getPlanningMilestoneRepository(): PlanningMilestoneRepository {
  return new PlanningMilestoneRepository();
}

export function getPlanningDocumentRepository(): PlanningDocumentRepository {
  return new PlanningDocumentRepository();
}

// Mappers (pure functions — safe for client bundle)
export { PlanningMapper } from "./mappers/PlanningMapper";
export { PlanningItemMapper } from "./mappers/PlanningItemMapper";
export { PlanningMilestoneMapper } from "./mappers/PlanningMilestoneMapper";

// DTOs
export type {
  PlanningListItemDTO,
  PlanningDetailDTO,
  CreatePlanningDTO,
  UpdatePlanningDTO,
} from "./dto/PlanningDTO";
export type { PlanningDashboardDTO } from "./dto/PlanningDashboardDTO";
export type { PlanningKanbanBoardDTO } from "./dto/PlanningKanbanDTO";

export type {
  PlanningItemDTO,
  CreatePlanningItemDTO,
  UpdatePlanningItemDTO,
} from "./dto/PlanningItemDTO";

export type {
  PlanningMilestoneDTO,
  UpdatePlanningMilestoneDTO,
} from "./dto/PlanningMilestoneDTO";

export type {
  PlanningTemplateListItemDTO,
  PlanningTemplateDetailDTO,
  CreatePlanningTemplateDTO,
  UpdatePlanningTemplateDTO,
} from "./dto/PlanningTemplateDTO";

// Entities (types only)
export type {
  PlanningType,
  PlanningStatus,
} from "./domain/entities/PlanningEntity";
export type { MilestoneStatus } from "./domain/entities/PlanningMilestoneEntity";

// Port types (for API route input typing)
export type { UpdatePlanningMilestoneInput } from "./domain/ports/IPlanningMilestoneRepository";

// Validators
export * from "./validators";

// Utils (UI helpers — status config, formatting)
export {
  PLANNING_STATUS_CONFIG,
  MILESTONE_STATUS_CONFIG,
  KANBAN_COLUMN_LABELS,
  formatBudget,
  formatDateShort,
} from "./utils/statusConfig";
