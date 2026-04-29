import type { AttendanceEvaluationResult } from "../types/AttendanceEvaluation";

export interface CheckInParams {
  userId: string;
  photoUrl: string | null;
  location: string;
  notes: string;
  latitude?: number;
  longitude?: number;
  offlineTime?: Date;
  timezone?: string;
  tenantId?: string;
}

export type HistoricalAttendanceRecomputeResult = {
  processedCount: number;
  evaluations: AttendanceEvaluationResult[];
};
