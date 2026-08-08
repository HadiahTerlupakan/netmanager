import type { PlanningType } from "../domain/entities/PlanningEntity";

/**
 * PlanningTemplateItemDTO - Template item structure
 */
export interface PlanningTemplateItemDTO {
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  estimatedPrice: number | null;
}

/**
 * PlanningTemplateListItemDTO - Summary view for template list
 */
export interface PlanningTemplateListItemDTO {
  id: string;
  name: string;
  description: string | null;
  type: PlanningType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * PlanningTemplateDetailDTO - Complete template with items
 */
export interface PlanningTemplateDetailDTO extends PlanningTemplateListItemDTO {
  tenantId: string;
  createdById: string | null;
  items: PlanningTemplateItemDTO[];
}

/**
 * CreatePlanningTemplateDTO - Request payload for creating template
 */
export interface CreatePlanningTemplateDTO {
  name: string;
  description?: string | null;
  type: PlanningType;
  isActive?: boolean;
  items: PlanningTemplateItemDTO[];
}

/**
 * UpdatePlanningTemplateDTO - Request payload for updating template
 */
export interface UpdatePlanningTemplateDTO {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  items?: PlanningTemplateItemDTO[];
}
