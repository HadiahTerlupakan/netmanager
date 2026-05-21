import type { SalaryAdvance } from "../entities/SalaryAdvance";
import type { SalaryAdvanceStatus } from "../enums";

export interface AdvanceFilter {
  tenantId: string;
  userId?: string;
  status?: SalaryAdvanceStatus;
}

export interface ISalaryAdvanceRepository {
  findById(id: string, tenantId: string): Promise<SalaryAdvance | null>;
  findActiveByUser(userId: string, tenantId: string): Promise<SalaryAdvance[]>;
  findAll(filter: AdvanceFilter): Promise<SalaryAdvance[]>;
  create(
    data: Omit<SalaryAdvance, "id" | "createdAt" | "updatedAt">,
  ): Promise<SalaryAdvance>;
  update(
    id: string,
    tenantId: string,
    data: Partial<SalaryAdvance>,
  ): Promise<SalaryAdvance>;
  updateStatus(
    id: string,
    tenantId: string,
    status: SalaryAdvanceStatus,
  ): Promise<SalaryAdvance>;
  countActive(userId: string, tenantId: string): Promise<number>;
}
