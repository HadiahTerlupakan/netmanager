/**
 * Planning Module — Client-Safe Public API
 *
 * Hanya berisi DTOs (type-only), entity types, validators (Zod), dan utils
 * (pure functions). TIDAK meng-export services atau repositories — sehingga
 * aman di-import dari client components tanpa menarik Prisma/pg/tls ke
 * client bundle.
 *
 * Client components: `import { ... } from "@/modules/planning/client"`
 * Server/API routes: `import { ... } from "@/modules/planning"` (full barrel)
 */

// Mappers (pure functions — safe for client bundle)
export { PlanningMapper } from "./mappers/PlanningMapper";
export { PlanningItemMapper } from "./mappers/PlanningItemMapper";
export { PlanningMilestoneMapper } from "./mappers/PlanningMilestoneMapper";

// DTOs (type-only — safe for client bundle)
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

// Entities (types only — safe for client bundle)
export type {
  PlanningType,
  PlanningStatus,
} from "./domain/entities/PlanningEntity";
export type { MilestoneStatus } from "./domain/entities/PlanningMilestoneEntity";

// Port types (for API route input typing)
export type { UpdatePlanningMilestoneInput } from "./domain/ports/IPlanningMilestoneRepository";

// Validators (Zod schemas — pure, safe for client bundle)
export * from "./validators";

// Utils (UI helpers — status config, formatting — pure, safe for client)
export {
  PLANNING_STATUS_CONFIG,
  MILESTONE_STATUS_CONFIG,
  KANBAN_COLUMN_LABELS,
  formatBudget,
  formatDateShort,
} from "./utils/statusConfig";
