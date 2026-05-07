/**
 * SystemLog DTOs (Data Transfer Objects)
 */

import type { SystemLogType } from "../types/SystemLog";

// ==================== Response DTOs ====================

/**
 * DTO for log list views
 */
export interface SystemLogListItemDTO {
  id: string;
  type: SystemLogType;
  action: string;
  subject: string;
  details: Record<string, unknown> | null;
  createdAt: string;
  // User info (nested for consistency with client expectations)
  user: {
    name: string | null;
    email: string;
  } | null;
}

/**
 * DTO for log detail views
 */
export interface SystemLogDetailDTO {
  id: string;
  type: SystemLogType;
  action: string;
  subject: string;
  details: Record<string, unknown> | null;
  createdAt: string;
  // User info
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  // Request info
  request: {
    ipAddress: string | null;
    userAgent: string | null;
  };
}

/**
 * DTO for activity timeline
 */
export interface ActivityTimelineDTO {
  id: string;
  action: string;
  subject: string;
  description: string;
  createdAt: string;
  user: {
    name: string | null;
  } | null;
}

/**
 * DTO for log statistics
 */
export interface LogStatisticsDTO {
  totalLogs: number;
  byAction: {
    action: string;
    count: number;
  }[];
  bySubject: {
    subject: string;
    count: number;
  }[];
  recentActivity: number;
}
