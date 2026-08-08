import type { PlanningType } from "./PlanningEntity";

export type { PlanningType };

export interface PlanningTemplateEntityProps {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  type: PlanningType;
  isActive: boolean;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * PlanningTemplateEntity represents a reusable template for creating
 * new planning documents with predefined items and configurations.
 */
export class PlanningTemplateEntity {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly description: string | null;
  readonly type: PlanningType;
  readonly isActive: boolean;
  readonly createdById: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: PlanningTemplateEntityProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.description = props.description;
    this.type = props.type;
    this.isActive = props.isActive;
    this.createdById = props.createdById;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * Check if template is active and can be used
   */
  canBeUsed(): boolean {
    return this.isActive;
  }

  /**
   * Check if template is inactive
   */
  isInactive(): boolean {
    return !this.isActive;
  }

  /**
   * Check if template is for OSP planning
   */
  isOSPTemplate(): boolean {
    return this.type === "OSP";
  }
}
