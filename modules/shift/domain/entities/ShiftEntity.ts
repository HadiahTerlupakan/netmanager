export interface ShiftUserEntity {
  id: string;
  name: string | null;
  email: string;
}

export interface ShiftEntity {
  id: string;
  name: string;
  code: string | null;
  startTime: string;
  endTime: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  tenantId: string | null;
  users: ShiftUserEntity[];
  userCount: number;
}
