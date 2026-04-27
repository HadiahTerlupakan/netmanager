import type {
  SystemLogActionStatEntity,
  SystemLogEntity,
  SystemLogListResultEntity,
  SystemLogSubjectStatEntity,
} from "../entities/SystemLogEntity";
import type { SystemLogType } from "../../types/SystemLog";

export interface SystemLogFilters {
  type?: SystemLogType;
  action?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  skip?: number;
  take?: number;
}

export interface ISystemLogRepository {
  /** Find logs with optional filters and pagination. */
  findAll(filters?: SystemLogFilters): Promise<SystemLogListResultEntity>;

  /** Find one log by identifier. */
  findById(id: string): Promise<SystemLogEntity | null>;

  /** Get recent log activity for timeline widgets. */
  getRecentActivity(limit?: number): Promise<SystemLogEntity[]>;

  /** Get grouped statistics by action. */
  getStatsByAction(
    startDate?: Date,
    endDate?: Date,
  ): Promise<SystemLogActionStatEntity[]>;

  /** Get grouped statistics by subject. */
  getStatsBySubject(
    startDate?: Date,
    endDate?: Date,
  ): Promise<SystemLogSubjectStatEntity[]>;

  /** Count total logs using optional filters. */
  count(filters?: SystemLogFilters): Promise<number>;
}
