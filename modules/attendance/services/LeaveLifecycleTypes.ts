import type { CreateLeaveData } from "./LeaveService";

export type LeaveWithUser = {
  id: string;
  userId: string;
  tenantId: string;
  type: CreateLeaveData["type"];
  startDate: Date;
  endDate: Date;
  status: "PENDING" | "APPROVED" | "REJECTED";
  user: {
    id: string;
    name: string | null;
    workingHourMode: string | null;
    workDays: string | null;
    tenantId: string | null;
    joinDate: Date | null;
    siteId?: string | null;
    departmentId?: string | null;
  };
};
