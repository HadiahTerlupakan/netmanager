export interface DepartmentUserSummaryEntity {
  id: string;
  name: string | null;
  email: string;
}

export interface DepartmentCountsEntity {
  users: number;
  workOrders: number;
}

export interface DepartmentEntity {
  id: string;
  name: string;
  description: string | null;
  jobDescription: string | null;
  isReminderTarget: boolean;
  showInMobileWO: boolean;
  users: DepartmentUserSummaryEntity[];
  counts: DepartmentCountsEntity;
  createdAt: Date;
  updatedAt: Date;
}
