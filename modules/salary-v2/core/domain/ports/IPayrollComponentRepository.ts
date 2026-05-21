import type { PayrollComponent } from "../entities/PayrollComponent";
import type { ComponentCategory } from "../enums";

export interface ComponentFilter {
  tenantId: string;
  category?: ComponentCategory;
  isActive?: boolean;
  isStatutory?: boolean;
}

export interface IPayrollComponentRepository {
  findById(id: string, tenantId: string): Promise<PayrollComponent | null>;
  findByCode(code: string, tenantId: string): Promise<PayrollComponent | null>;
  findAll(filter: ComponentFilter): Promise<PayrollComponent[]>;
  create(
    data: Omit<PayrollComponent, "id" | "createdAt" | "updatedAt">,
  ): Promise<PayrollComponent>;
  update(
    id: string,
    tenantId: string,
    data: Partial<PayrollComponent>,
  ): Promise<PayrollComponent>;
  delete(id: string, tenantId: string): Promise<void>;
}
