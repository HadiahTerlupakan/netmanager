/**
 * Planning Module Public API
 * Export public services, DTOs, validators, repositories, and mappers
 */

// Services
export {
  planningService,
  planningApprovalService,
  planningTemplateService,
  planningAuditService,
  planningKanbanService,
  planningDashboardService,
} from "./services/PlanningServiceFactory";

// Repositories (for direct use in API routes)
export { PlanningRepository } from "./repositories/PlanningRepository";
export { PlanningItemRepository } from "./repositories/PlanningItemRepository";
export { PlanningMilestoneRepository } from "./repositories/PlanningMilestoneRepository";
export { PlanningDocumentRepository } from "./repositories/PlanningDocumentRepository";

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
