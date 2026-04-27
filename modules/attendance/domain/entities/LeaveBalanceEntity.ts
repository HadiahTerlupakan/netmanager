import type { LeaveTypeValue } from "./LeaveEntity";

export interface LeaveBalanceEntity {
  id: string;
  tenantId: string | null;
  userId: string;
  year: number;
  leaveType: LeaveTypeValue;
  quota: number;
  used: number;
  updatedAt: Date;
}
