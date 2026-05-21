import type { PaySchedule } from "../entities/PaySchedule";

export interface IPayScheduleRepository {
  findById(id: string, tenantId: string): Promise<PaySchedule | null>;
  findDefault(tenantId: string): Promise<PaySchedule | null>;
  findAll(tenantId: string): Promise<PaySchedule[]>;
  create(
    data: Omit<PaySchedule, "id" | "createdAt" | "updatedAt">,
  ): Promise<PaySchedule>;
  update(
    id: string,
    tenantId: string,
    data: Partial<PaySchedule>,
  ): Promise<PaySchedule>;
  delete(id: string, tenantId: string): Promise<void>;
}
