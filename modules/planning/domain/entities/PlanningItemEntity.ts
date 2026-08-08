export interface PlanningItemEntityProps {
  id: string;
  planningId: string;
  tenantId: string;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  estimatedPrice: number | null;
  actualPrice: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * PlanningItemEntity represents a single line item in a planning document,
 * such as materials or resources required for the project.
 */
export class PlanningItemEntity {
  readonly id: string;
  readonly planningId: string;
  readonly tenantId: string;
  readonly name: string;
  readonly description: string | null;
  readonly quantity: number;
  readonly unit: string;
  readonly estimatedPrice: number | null;
  readonly actualPrice: number | null;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: PlanningItemEntityProps) {
    this.id = props.id;
    this.planningId = props.planningId;
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.description = props.description;
    this.quantity = props.quantity;
    this.unit = props.unit;
    this.estimatedPrice = props.estimatedPrice;
    this.actualPrice = props.actualPrice;
    this.notes = props.notes;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * Calculate total estimated cost (quantity × estimatedPrice)
   */
  getTotalEstimated(): number | null {
    if (this.estimatedPrice === null) {
      return null;
    }
    return this.quantity * this.estimatedPrice;
  }

  /**
   * Calculate total actual cost (quantity × actualPrice)
   */
  getTotalActual(): number | null {
    if (this.actualPrice === null) {
      return null;
    }
    return this.quantity * this.actualPrice;
  }

  /**
   * Calculate cost variance between actual and estimated
   */
  getCostVariance(): number | null {
    const totalEstimated = this.getTotalEstimated();
    const totalActual = this.getTotalActual();

    if (totalEstimated === null || totalActual === null) {
      return null;
    }

    return totalActual - totalEstimated;
  }

  /**
   * Check if item is over estimated cost
   */
  isOverEstimated(): boolean {
    const variance = this.getCostVariance();
    return variance !== null && variance > 0;
  }

  /**
   * Check if actual price has been recorded
   */
  hasActualPrice(): boolean {
    return this.actualPrice !== null;
  }

  /**
   * Check if estimated price has been set
   */
  hasEstimatedPrice(): boolean {
    return this.estimatedPrice !== null;
  }
}
