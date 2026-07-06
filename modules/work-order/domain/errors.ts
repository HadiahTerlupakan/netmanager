/**
 * Work Order Domain Errors
 *
 * Custom error classes for work order validation failures.
 * Provides specific error codes and detailed context for debugging.
 */

export interface WorkOrderErrorDetails {
  workOrderId?: string;
  userId?: string;
  currentStatus?: string;
  claimedAt?: Date | string;
  assignedTo?: string;
  assignedToId?: string;
  assignedMitraId?: string;
  currentClaims?: string[];
  maxAllowed?: number;
  currentCount?: number;
  userRole?: string;
  tenantId?: string;
  siteId?: string;
  departmentId?: string;
  reason?: string;
  [key: string]: unknown;
}

/**
 * Work Order Validation Error
 *
 * Thrown when work order operations fail validation.
 * Always includes specific error code and detailed context.
 */
export class WorkOrderValidationError extends Error {
  constructor(
    public code: WorkOrderErrorCode,
    public override message: string,
    public details?: WorkOrderErrorDetails,
  ) {
    super(message);
    this.name = "WorkOrderValidationError";
    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to structured API response format
   */
  toApiResponse() {
    return {
      error: this.code,
      message: this.message,
      details: this.details || {},
    };
  }
}

/**
 * Work Order Error Codes
 */
export enum WorkOrderErrorCode {
  // Work Order Not Found
  NOT_FOUND = "WO_NOT_FOUND",

  // Already Claimed by This User
  ALREADY_CLAIMED = "WO_ALREADY_CLAIMED",

  // Work Order Not Available (claimed by someone else or wrong status)
  NOT_AVAILABLE = "WO_NOT_AVAILABLE",

  // Access Denied (site/department mismatch)
  ACCESS_DENIED = "WO_ACCESS_DENIED",

  // Maximum Concurrent Work Orders Reached
  MAX_LIMIT_REACHED = "WO_MAX_LIMIT_REACHED",

  // Invalid Work Order State
  INVALID_STATE = "WO_INVALID_STATE",
}

/**
 * Error Factory Functions
 *
 * Provides convenient methods to create specific work order errors
 * with proper error codes and context.
 */
export const WorkOrderErrors = {
  /**
   * Work order not found in database
   */
  notFound(workOrderId: string, tenantId?: string): WorkOrderValidationError {
    return new WorkOrderValidationError(
      WorkOrderErrorCode.NOT_FOUND,
      "Work order tidak ditemukan",
      { workOrderId, tenantId },
    );
  },

  /**
   * User already claimed this work order previously
   */
  alreadyClaimed(
    workOrderId: string,
    userId: string,
    claimedAt: Date,
  ): WorkOrderValidationError {
    return new WorkOrderValidationError(
      WorkOrderErrorCode.ALREADY_CLAIMED,
      "Anda sudah mengambil work order ini sebelumnya",
      {
        workOrderId,
        userId,
        claimedAt: claimedAt.toISOString(),
      },
    );
  },

  /**
   * Work order not available (already claimed by someone else)
   */
  notAvailable(
    workOrderId: string,
    currentStatus: string,
    assignedToId?: string | null,
    assignedMitraId?: string | null,
  ): WorkOrderValidationError {
    const assignedTo = assignedToId || assignedMitraId || "Unknown";
    return new WorkOrderValidationError(
      WorkOrderErrorCode.NOT_AVAILABLE,
      "Work order sudah diambil teknisi lain atau tidak tersedia",
      {
        workOrderId,
        currentStatus,
        assignedToId: assignedToId || undefined,
        assignedMitraId: assignedMitraId || undefined,
        assignedTo,
      },
    );
  },

  /**
   * Access denied due to site/department mismatch
   */
  accessDenied(
    workOrderId: string,
    reason: string,
    details?: WorkOrderErrorDetails,
  ): WorkOrderValidationError {
    return new WorkOrderValidationError(
      WorkOrderErrorCode.ACCESS_DENIED,
      `Anda tidak memiliki akses ke Work Order ini (${reason})`,
      {
        workOrderId,
        reason,
        ...details,
      },
    );
  },

  /**
   * User reached maximum concurrent work orders
   */
  maxLimitReached(
    currentCount: number,
    maxAllowed: number,
    activeWorkOrders: string[],
  ): WorkOrderValidationError {
    return new WorkOrderValidationError(
      WorkOrderErrorCode.MAX_LIMIT_REACHED,
      `Anda sudah memiliki ${currentCount} work order aktif (maksimal ${maxAllowed})`,
      {
        currentCount,
        maxAllowed,
        currentClaims: activeWorkOrders,
      },
    );
  },

  /**
   * Work order in invalid state for operation
   */
  invalidState(
    workOrderId: string,
    currentStatus: string,
    reason: string,
  ): WorkOrderValidationError {
    return new WorkOrderValidationError(
      WorkOrderErrorCode.INVALID_STATE,
      reason,
      {
        workOrderId,
        currentStatus,
        reason,
      },
    );
  },
};
