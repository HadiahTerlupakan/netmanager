/**
 * DTO for Planning Template Item
 */
export interface PlanningTemplateItemDTO {
  id: string;
  templateId: string;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  estimatedPrice: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  totalEstimated: number | null;
}

/**
 * DTO for creating Planning Template Item
 */
export interface CreatePlanningTemplateItemDTO {
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  estimatedPrice?: number;
  notes?: string;
}

/**
 * DTO for updating Planning Template Item
 */
export interface UpdatePlanningTemplateItemDTO {
  name?: string;
  description?: string;
  quantity?: number;
  unit?: string;
  estimatedPrice?: number;
  notes?: string;
}
