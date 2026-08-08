/**
 * PlanningItemDTO - Standard item representation for API responses
 */
export interface PlanningItemDTO {
  id: string;
  planningId: string;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  estimatedPrice: number | null;
  actualPrice: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;

  // Computed fields
  totalEstimated: number | null;
  totalActual: number | null;
}

/**
 * CreatePlanningItemDTO - Request payload for creating new item
 */
export interface CreatePlanningItemDTO {
  name: string;
  description?: string | null;
  quantity: number;
  unit: string;
  estimatedPrice?: number | null;
  notes?: string | null;
}

/**
 * UpdatePlanningItemDTO - Request payload for updating existing item
 * All fields optional to support partial updates
 */
export interface UpdatePlanningItemDTO {
  name?: string;
  description?: string | null;
  quantity?: number;
  unit?: string;
  estimatedPrice?: number | null;
  actualPrice?: number | null;
  notes?: string | null;
}
