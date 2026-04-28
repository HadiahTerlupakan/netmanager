/**
 * User DTOs (Data Transfer Objects)
 *
 * DTOs define the shape of data for API responses and requests.
 * Sensitive fields like passwordHash are never exposed.
 */

import type { WorkingHourMode } from "@prisma/client";

// ==================== Response DTOs ====================

/**
 * Minimal DTO for list/table views
 */
export interface UserListItemDTO {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  isActive: boolean;
  isSales: boolean;
  // Flattened relations
  roleName: string | null;
  departmentName: string | null;
  siteName: string | null;
}

/**
 * Full DTO for detail views
 */
export interface UserDetailDTO {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  isActive: boolean;
  isSales: boolean;
  isAttendanceRequired: boolean;
  createdAt: string;
  updatedAt: string;
  // Relations
  role: {
    id: string;
    name: string;
  } | null;
  department: {
    id: string;
    name: string;
  } | null;
  site: {
    id: string;
    name: string;
  } | null;
  // Working hours
  workingHours: {
    mode: WorkingHourMode;
    startWorkTime: string | null;
    endWorkTime: string | null;
    workDays: string | null;
    flexibleTargetHour: number | null;
    shift: {
      id: string;
      name: string;
    } | null;
  };
  // Multi-site access
  userSites: {
    siteId: string;
    siteName: string;
  }[];
}

/**
 * DTO for session/auth context
 */
export interface UserSessionDTO {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
  roleId: string | null;
  departmentId: string | null;
  siteId: string | null;
  permissions: string[];
}

/**
 * DTO for dropdown/select options
 */
export interface UserOptionDTO {
  id: string;
  name: string | null;
  email: string;
  departmentName: string | null;
}

/**
 * DTO for employee assignment (work orders, tasks)
 */
export interface EmployeeAssignmentDTO {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  isActive: boolean;
  departmentId: string | null;
  siteId: string | null;
}

// ==================== Request DTOs ====================

/**
 * DTO for creating new user
 */
export interface CreateUserDTO {
  email: string;
  name?: string;
  password: string;
  phone?: string;
  departmentId?: string;
  siteId?: string;
  roleId?: string;
  isActive?: boolean;
  isSales?: boolean;
  // Working hours
  workingHourMode?: WorkingHourMode;
  startWorkTime?: string;
  endWorkTime?: string;
  workDays?: string;
  flexibleTargetHour?: number;
  shiftId?: string;
}

/**
 * DTO for updating user
 */
export interface UpdateUserDTO {
  email?: string;
  name?: string;
  phone?: string;
  departmentId?: string | null;
  siteId?: string | null;
  roleId?: string | null;
  isActive?: boolean;
}

/**
 * DTO for updating working hours
 */
export interface UpdateWorkingHoursDTO {
  workingHourMode: WorkingHourMode;
  startWorkTime?: string | null;
  endWorkTime?: string | null;
  workDays?: string | null;
  flexibleTargetHour?: number | null;
  shiftId?: string | null;
}
