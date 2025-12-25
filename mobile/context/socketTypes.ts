// WebSocket Event Types for Real-time Communication (Mobile)

export const SOCKET_EVENTS = {
    // Notifications
    NOTIFICATION_NEW: 'notification:new',
    NOTIFICATION_READ: 'notification:read',
    NOTIFICATION_COUNT: 'notification:count',

    // Work Orders
    WORKORDER_NEW: 'workorder:new',
    WORKORDER_UPDATE: 'workorder:update',
    WORKORDER_ASSIGNED: 'workorder:assigned',
    WORKORDER_ACTIVITY: 'workorder:activity',

    // Partner Invitation (custom for mobile)
    PARTNER_INVITATION: 'partner:invitation',
    PARTNER_RESPONSE: 'partner:response',

    // Connection management
    JOIN_ROOM: 'join:room',
    LEAVE_ROOM: 'leave:room',
} as const;

// Work order payload
export interface WorkOrderPayload {
    id: string;
    workOrderNumber: string;
    title: string;
    type: string;
    status: string;
    priority: string;
    assignedToId?: string;
    departmentId?: string;
}

// Work order activity payload
export interface WorkOrderActivityPayload {
    workOrderId: string;
    activity: {
        id: string;
        type: 'comment' | 'update' | 'attachment';
        message?: string;
        updateType?: string;
        createdAt: string;
        createdBy?: {
            id: string;
            name?: string;
        } | null;
    };
}

// Partner invitation payload
export interface PartnerInvitationPayload {
    workOrderId: string;
    workOrderNumber: string;
    workOrderTitle: string;
    invitedBy: {
        id: string;
        name: string;
    };
    partnerId: string;
}

// Partner response payload
export interface PartnerResponsePayload {
    workOrderId: string;
    partnerId: string;
    partnerName: string;
    response: 'APPROVED' | 'REJECTED';
}
