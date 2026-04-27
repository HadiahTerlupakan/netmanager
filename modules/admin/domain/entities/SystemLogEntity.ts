import type { SystemLogType } from "../../types/SystemLog";

export interface SystemLogUserEntity {
  id: string;
  name: string | null;
  email: string;
}

export interface SystemLogRequestEntity {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface SystemLogEntity {
  id: string;
  type: SystemLogType;
  action: string;
  subject: string;
  details: Record<string, unknown> | null;
  createdAt: Date;
  user: SystemLogUserEntity | null;
  request: SystemLogRequestEntity;
}

export interface SystemLogListResultEntity {
  data: SystemLogEntity[];
  total: number;
}

export interface SystemLogActionStatEntity {
  action: string;
  count: number;
}

export interface SystemLogSubjectStatEntity {
  subject: string;
  count: number;
}
