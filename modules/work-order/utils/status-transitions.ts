/**
 * Work Order Status Transition Validation
 * 
 * Defines valid status transitions to ensure business flow integrity.
 * Prevents invalid status changes (e.g., CANCELLED -> IN_PROGRESS)
 */

import type { WorkOrderStatus } from '@prisma/client';

/**
 * Valid status transitions matrix
 * Key = current status, Value = array of allowed next statuses
 */
export const VALID_STATUS_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
    // Mobile WO Request: dapat di-approve (PENDING) atau di-reject (CANCELLED)
    REQUESTED: ['PENDING', 'CANCELLED'],
    
    // PENDING: dapat di-assign atau dibatalkan
    PENDING: ['ASSIGNED', 'CANCELLED'],
    
    // ASSIGNED: teknisi sudah ditunjuk, bisa mulai kerja atau dibatalkan
    ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
    
    // IN_PROGRESS: sedang dikerjakan, bisa ditunda, selesai, atau dibatalkan
    IN_PROGRESS: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
    
    // ON_HOLD: sedang ditunda, bisa dilanjutkan atau dibatalkan
    ON_HOLD: ['IN_PROGRESS', 'CANCELLED'],
    
    // COMPLETED: pekerjaan selesai, menunggu verifikasi (bisa ditolak/revisi kembali ke IN_PROGRESS)
    COMPLETED: ['VERIFIED', 'IN_PROGRESS'],
    
    // VERIFIED: sudah diverifikasi, siap ditutup
    VERIFIED: ['CLOSED'],
    
    // CLOSED: final state, tidak bisa diubah lagi
    CLOSED: [],
    
    // CANCELLED: final state, tidak bisa diubah lagi
    CANCELLED: [],
};

/**
 * Check if status transition is valid
 * @param currentStatus Current work order status
 * @param newStatus Desired new status
 * @returns true if transition is allowed
 */
export function isValidStatusTransition(
    currentStatus: WorkOrderStatus,
    newStatus: WorkOrderStatus
): boolean {
    // Same status is always valid (no-op)
    if (currentStatus === newStatus) {
        return true;
    }

    const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus];
    return allowedTransitions.includes(newStatus);
}

/**
 * Get human-readable transition error message
 */
export function getTransitionErrorMessage(
    currentStatus: WorkOrderStatus,
    newStatus: WorkOrderStatus
): string {
    const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus];
    
    if (allowedTransitions.length === 0) {
        return `Status ${currentStatus} adalah status final dan tidak dapat diubah`;
    }
    
    return `Transisi dari ${currentStatus} ke ${newStatus} tidak diizinkan. Status yang diizinkan: ${allowedTransitions.join(', ')}`;
}

/**
 * Validate status transition and throw error if invalid
 * @throws Error if transition is invalid
 */
export function validateStatusTransition(
    currentStatus: WorkOrderStatus,
    newStatus: WorkOrderStatus
): void {
    if (!isValidStatusTransition(currentStatus, newStatus)) {
        throw new Error(getTransitionErrorMessage(currentStatus, newStatus));
    }
}

/**
 * Check if status is a final state (cannot be changed)
 */
export function isFinalStatus(status: WorkOrderStatus): boolean {
    return VALID_STATUS_TRANSITIONS[status].length === 0;
}

/**
 * Get all possible next statuses for current status
 */
export function getNextValidStatuses(currentStatus: WorkOrderStatus): WorkOrderStatus[] {
    return VALID_STATUS_TRANSITIONS[currentStatus];
}
