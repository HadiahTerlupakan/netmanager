export interface PlanningTemplateItemEntityProps {
  id: string;
  templateId: string;
  tenantId: string;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  estimatedPrice: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * PlanningTemplateItemEntity represents a predefined item in a planning template,
 * used to quickly populate new planning documents with standard items.
 */
export class PlanningTemplateItemEntity {
  readonly id: string;
  readonly templateId: string;
  readonly tenantId: string;
  readonly name: string;
  readonly description: string | null;
  readonly quantity: number;
  readonly unit: string;
  readonly estimatedPrice: number | null;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: PlanningTemplateItemEntityProps) {
    this.id = props.id;
    this.templateId = props.templateId;
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.description = props.description;
    this.quantity = props.quantity;
    this.unit = props.unit;
    this.estimatedPrice = props.estimatedPrice;
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
   * Check if estimated price has been set
   */
  hasEstimatedPrice(): boolean {
    return this.estimatedPrice !== null;
  }
}
