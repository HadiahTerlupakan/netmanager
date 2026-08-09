/**
 * Planning Module Public API
 * Export public services, DTOs, validators, mappers, and repository factories.
 */

import { PlanningRepository } from "./repositories/PlanningRepository";
import { PlanningItemRepository } from "./repositories/PlanningItemRepository";
import { PlanningMilestoneRepository } from "./repositories/PlanningMilestoneRepository";
import { PlanningDocumentRepository } from "./repositories/PlanningDocumentRepository";

// Services
export {
  planningService,
  planningApprovalService,
  planningTemplateService,
  planningAuditService,
  planningKanbanService,
  planningDashboardService,
} from "./services/PlanningServiceFactory";

// Repository factories (for direct use in API routes)
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

// Mappers (for DTO conversion in API routes)
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
