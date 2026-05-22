/**
 * Event Type Definitions for the RadPro Event-Driven Architecture
 *
 * All domain events across modules are defined here with strict typing.
 * Each event has a unique name, associated payload type, and routing metadata.
 */

// ============================================
// EVENT CATEGORIES
// ============================================

export const EVENT_CATEGORIES = {
  BILLING: "billing",
  NOTIFICATION: "notification",
  WORK_ORDER: "work_order",
  TICKET: "ticket",
  INVENTORY: "inventory",
  ATTENDANCE: "attendance",
  CUSTOMER: "customer",
  NETWORK: "network",
  SYSTEM: "system",
  SALARY: "salary",
  USERS: "users",
} as const;

export type EventCategory =
  (typeof EVENT_CATEGORIES)[keyof typeof EVENT_CATEGORIES];

// ============================================
// EVENT NAMES (Central Registry)
// ============================================

export const EVENT_NAMES = {
  // Billing Events
  INVOICE_CREATED: "billing:invoice.created",
  INVOICE_PAID: "billing:invoice.paid",
  INVOICE_OVERDUE: "billing:invoice.overdue",
  INVOICE_REMINDER_DUE: "billing:invoice.reminder_due",
  INVOICE_AUTO_ISOLATE_REQUESTED: "billing:invoice.auto_isolate_requested",
  PAYMENT_FAILED: "billing:payment.failed",
  COUPON_USED: "billing:coupon.used",
  PACKAGE_CHANGED: "billing:package.changed",

  // User Lifecycle Events
  USER_CREATED: "users:user.created",
  USER_UPDATED: "users:user.updated",
  USER_DEACTIVATED: "users:user.deactivated",

  // Finance Events (for accounting consumption)
  EXPENSE_APPROVED: "finance:expense.approved",
  PURCHASE_ORDER_PAID: "finance:purchase_order.paid",
  SALARY_PROCESSED: "salary:salary.processed",
  MITRA_WITHDRAWAL_COMPLETED: "mitra:withdrawal.completed",
  INVESTOR_PAYOUT_COMPLETED: "investor:payout.completed",
  INVESTOR_DEPOSIT_COMPLETED: "investor:deposit.completed",

  // Customer Events
  CUSTOMER_CREATED: "customer:created",
  CUSTOMER_UPDATED: "customer:updated",
  CUSTOMER_SUSPENDED: "customer:suspended",
  CUSTOMER_ACTIVATED: "customer:activated",
  CUSTOMER_ISOLATED: "customer:isolated",
  CUSTOMER_DELETED: "customer:deleted",

  // Work Order Events
  WORK_ORDER_CREATED: "workorder:created",
  WORK_ORDER_ASSIGNED: "workorder:assigned",
  WORK_ORDER_UPDATED: "workorder:updated",
  WORK_ORDER_COMPLETED: "workorder:completed",
  WORK_ORDER_ACTIVITY: "workorder:activity",

  // Ticket Events
  TICKET_CREATED: "ticket:created",
  TICKET_REPLY: "ticket:reply",
  TICKET_STATUS_CHANGED: "ticket:status_changed",

  // Inventory Events
  INVENTORY_STOCK_IN: "inventory:stock_in",
  INVENTORY_STOCK_OUT: "inventory:stock_out",
  INVENTORY_LOW_STOCK: "inventory:low_stock",

  // Attendance Events
  ATTENDANCE_CHECKIN: "attendance:checkin",
  ATTENDANCE_CHECKOUT: "attendance:checkout",
  ATTENDANCE_ABSENT: "attendance:absent",

  // Network Events
  NETWORK_DEVICE_ONLINE: "network:device.online",
  NETWORK_DEVICE_OFFLINE: "network:device.offline",
  NETWORK_RADIUS_UPDATE: "network:radius.update",
  PROFILE_PPP_UPDATED: "network:profile_ppp.updated",

  // Notification Events
  NOTIFICATION_CREATED: "notification:created",
  NOTIFICATION_PUSH_SENT: "notification:push_sent",
  NOTIFICATION_PUSH_FAILED: "notification:push_failed",

  // System Events
  SYSTEM_USER_LOGIN: "system:user.login",
  SYSTEM_USER_LOGOUT: "system:user.logout",
  SYSTEM_ERROR: "system:error",
} as const;

export type EventName = (typeof EVENT_NAMES)[keyof typeof EVENT_NAMES];

// ============================================
// EVENT PAYLOADS
// ============================================

export interface BaseEventPayload {
  /** Tenant ID for multi-tenant isolation */
  tenantId?: string;
  /** User ID who triggered the event */
  triggeredBy?: string;
  /** Timestamp when the event occurred */
  timestamp?: string;
}

export interface InvoiceCreatedPayload extends BaseEventPayload {
  invoiceId: string;
  pelangganId: string;
  amount: number;
  dueDate: string;
}

export interface InvoicePaidPayload extends BaseEventPayload {
  invoiceId: string;
  pelangganId: string;
  amount: number;
  paidAt: string;
  paymentMethod?: string;
}

export interface CouponUsedPayload extends BaseEventPayload {
  couponId: string;
  pelangganId: string;
  invoiceIds: string[];
  discountAmount: number;
  appliedAt: string;
}

export interface CustomerCreatedPayload extends BaseEventPayload {
  customerId: string;
  customerName: string;
  packageId?: string;
}

export interface CustomerStatusPayload extends BaseEventPayload {
  customerId: string;
  customerName: string;
  oldStatus: string;
  newStatus: string;
}

export interface CustomerDeletedPayload extends BaseEventPayload {
  customerId: string;
  customerName?: string;
  username: string;
}

export interface InvoiceAutoIsolatePayload extends BaseEventPayload {
  invoiceId: string;
  pelangganId: string;
  invoiceNumber: string;
}

export interface InvoiceReminderDuePayload extends BaseEventPayload {
  invoiceId: string;
  pelangganId: string;
  invoiceNumber: string;
  amountDue: number;
  dueDate: string;
  reminderType: "UPCOMING" | "DUE_TODAY" | "OVERDUE";
}

export interface WorkOrderCreatedPayload extends BaseEventPayload {
  workOrderId: string;
  workOrderNumber: string;
  title: string;
  type: string;
  priority: string;
  departmentId?: string;
  siteId?: string;
  assignedToId?: string;
}

export interface WorkOrderAssignedPayload extends BaseEventPayload {
  workOrderId: string;
  workOrderNumber: string;
  title: string;
  assignedToId: string;
  assignedToName?: string;
  departmentId?: string;
  siteId?: string;
}

export interface WorkOrderUpdatedPayload extends BaseEventPayload {
  workOrderId: string;
  workOrderNumber: string;
  title: string;
  updateMessage: string;
  updatedByName?: string;
  departmentId?: string;
  siteId?: string;
  assignedToId?: string;
  excludeUserIds?: string[];
}

export interface WorkOrderCompletedPayload extends BaseEventPayload {
  workOrderId: string;
  workOrderNumber: string;
  title: string;
  completedByName?: string;
  departmentId?: string;
  siteId?: string;
  assignedToId?: string;
}

export interface WorkOrderActivityPayload extends BaseEventPayload {
  workOrderId: string;
  activityId: string;
  activityType: "comment" | "update" | "attachment";
  message?: string;
  userName?: string;
}

export interface TicketCreatedPayload extends BaseEventPayload {
  ticketId: string;
  ticketNumber: string;
  subject: string;
  priority: string;
  pelangganNama?: string;
  siteId?: string;
}

export interface TicketReplyPayload extends BaseEventPayload {
  ticketId: string;
  ticketNumber: string;
  replyId: string;
  message: string;
  isFromAdmin: boolean;
  siteId?: string;
  targetUserId?: string;
}

export interface InventoryPayload extends BaseEventPayload {
  type: "masuk" | "keluar";
  barangId: string;
  barangName?: string;
  gudangId?: string;
  jumlah: number;
  totalStok?: number;
  userId: string;
  siteId?: string;
}

export interface AttendancePayload extends BaseEventPayload {
  userId: string;
  userName?: string;
  attendanceId: string;
  type: "checkin" | "checkout" | "absent";
  timestamp: string;
  location?: { lat: number; lng: number };
}

export interface NetworkDevicePayload extends BaseEventPayload {
  deviceId: string;
  deviceName: string;
  deviceType: "mikrotik" | "radius";
  status: "online" | "offline";
  tenantId: string;
  stats?: Record<string, unknown>;
}

export interface NotificationPayload extends BaseEventPayload {
  notificationId: string;
  title: string;
  message: string;
  userId?: string;
  departmentId?: string;
  type: string;
  priority: string;
  link?: string;
  sourceType?: string;
  sourceId?: string;
}

export interface PushNotificationPayload extends BaseEventPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  pushToken?: string;
  subscription?: {
    endpoint: string;
    p256dh: string;
    auth: string;
  };
}

export interface SystemEventPayload extends BaseEventPayload {
  userId?: string;
  action: string;
  details?: Record<string, unknown>;
}

export interface PackageChangedPayload extends BaseEventPayload {
  customerId: string;
  customerName: string;
  oldPackageId: string;
  newPackageId: string;
  oldProfileName: string;
  newProfileName: string;
  oldPackagePrice: number;
  newPackagePrice: number;
  applyTime: "IMMEDIATE" | "NEXT_CYCLE";
}

export interface ProfilePppUpdatedPayload extends BaseEventPayload {
  profileId: string;
  profileName: string;
  bandwidthChanged: boolean;
  affectedCustomerCount: number;
}

export interface ExpenseApprovedPayload extends BaseEventPayload {
  expenseId: string;
  tenantId: string;
  amount: string;
  accountId: string;
  expenseCategoryId: string;
  expenseDate: string;
}

export interface PurchaseOrderPaidPayload extends BaseEventPayload {
  purchaseOrderId: string;
  tenantId: string;
  amount: string;
  accountId: string;
  paidAt: string;
}

export interface SalaryProcessedPayload extends BaseEventPayload {
  salaryId: string;
  tenantId: string;
  userId: string;
  grossSalary: string;
  pph21Amount: string;
  month: number;
  year: number;
  processedAt: string;
}

export interface MitraWithdrawalCompletedPayload extends BaseEventPayload {
  withdrawalId: string;
  tenantId: string;
  mitraId: string;
  amount: string;
  method: string;
  completedAt: string;
}

export interface InvestorPayoutCompletedPayload extends BaseEventPayload {
  payoutId: string;
  tenantId: string;
  investorId: string;
  amount: string;
  completedAt: string;
}

export interface InvestorDepositCompletedPayload extends BaseEventPayload {
  depositId: string;
  investorId: string;
  tenantId: string;
  amount: string;
  depositType: string;
  completedAt: string;
}

export interface UserCreatedPayload extends BaseEventPayload {
  userId: string;
  tenantId: string;
  name: string | null;
  email: string;
  basicSalary: number | null;
  ptkpStatus: string | null;
  isActive: boolean;
}

export interface UserUpdatedPayload extends BaseEventPayload {
  userId: string;
  tenantId: string;
  basicSalary?: number | null;
  ptkpStatus?: string | null;
  isActive?: boolean;
  changedFields: string[];
}

export interface UserDeactivatedPayload extends BaseEventPayload {
  userId: string;
  tenantId: string;
}

// ============================================
// PAYLOAD MAP (Type-safe event → payload mapping)
// ============================================

export interface EventPayloadMap {
  [EVENT_NAMES.INVOICE_CREATED]: InvoiceCreatedPayload;
  [EVENT_NAMES.INVOICE_PAID]: InvoicePaidPayload;
  [EVENT_NAMES.INVOICE_OVERDUE]: InvoiceCreatedPayload;
  [EVENT_NAMES.INVOICE_REMINDER_DUE]: InvoiceReminderDuePayload;
  [EVENT_NAMES.INVOICE_AUTO_ISOLATE_REQUESTED]: InvoiceAutoIsolatePayload;
  [EVENT_NAMES.PAYMENT_FAILED]: InvoiceCreatedPayload;
  [EVENT_NAMES.COUPON_USED]: CouponUsedPayload;
  [EVENT_NAMES.CUSTOMER_CREATED]: CustomerCreatedPayload;
  [EVENT_NAMES.CUSTOMER_UPDATED]: CustomerCreatedPayload;
  [EVENT_NAMES.CUSTOMER_SUSPENDED]: CustomerStatusPayload;
  [EVENT_NAMES.CUSTOMER_ACTIVATED]: CustomerStatusPayload;
  [EVENT_NAMES.CUSTOMER_ISOLATED]: CustomerStatusPayload;
  [EVENT_NAMES.CUSTOMER_DELETED]: CustomerDeletedPayload;
  [EVENT_NAMES.WORK_ORDER_CREATED]: WorkOrderCreatedPayload;
  [EVENT_NAMES.WORK_ORDER_ASSIGNED]: WorkOrderAssignedPayload;
  [EVENT_NAMES.WORK_ORDER_UPDATED]: WorkOrderUpdatedPayload;
  [EVENT_NAMES.WORK_ORDER_COMPLETED]: WorkOrderCompletedPayload;
  [EVENT_NAMES.WORK_ORDER_ACTIVITY]: WorkOrderActivityPayload;
  [EVENT_NAMES.TICKET_CREATED]: TicketCreatedPayload;
  [EVENT_NAMES.TICKET_REPLY]: TicketReplyPayload;
  [EVENT_NAMES.TICKET_STATUS_CHANGED]: TicketCreatedPayload;
  [EVENT_NAMES.INVENTORY_STOCK_IN]: InventoryPayload;
  [EVENT_NAMES.INVENTORY_STOCK_OUT]: InventoryPayload;
  [EVENT_NAMES.INVENTORY_LOW_STOCK]: InventoryPayload;
  [EVENT_NAMES.ATTENDANCE_CHECKIN]: AttendancePayload;
  [EVENT_NAMES.ATTENDANCE_CHECKOUT]: AttendancePayload;
  [EVENT_NAMES.ATTENDANCE_ABSENT]: AttendancePayload;
  [EVENT_NAMES.NETWORK_DEVICE_ONLINE]: NetworkDevicePayload;
  [EVENT_NAMES.NETWORK_DEVICE_OFFLINE]: NetworkDevicePayload;
  [EVENT_NAMES.NETWORK_RADIUS_UPDATE]: NetworkDevicePayload;
  [EVENT_NAMES.NOTIFICATION_CREATED]: NotificationPayload;
  [EVENT_NAMES.NOTIFICATION_PUSH_SENT]: PushNotificationPayload;
  [EVENT_NAMES.NOTIFICATION_PUSH_FAILED]: PushNotificationPayload;
  [EVENT_NAMES.SYSTEM_USER_LOGIN]: SystemEventPayload;
  [EVENT_NAMES.SYSTEM_USER_LOGOUT]: SystemEventPayload;
  [EVENT_NAMES.SYSTEM_ERROR]: SystemEventPayload;
  [EVENT_NAMES.PACKAGE_CHANGED]: PackageChangedPayload;
  [EVENT_NAMES.PROFILE_PPP_UPDATED]: ProfilePppUpdatedPayload;
  [EVENT_NAMES.EXPENSE_APPROVED]: ExpenseApprovedPayload;
  [EVENT_NAMES.PURCHASE_ORDER_PAID]: PurchaseOrderPaidPayload;
  [EVENT_NAMES.SALARY_PROCESSED]: SalaryProcessedPayload;
  [EVENT_NAMES.MITRA_WITHDRAWAL_COMPLETED]: MitraWithdrawalCompletedPayload;
  [EVENT_NAMES.INVESTOR_PAYOUT_COMPLETED]: InvestorPayoutCompletedPayload;
  [EVENT_NAMES.INVESTOR_DEPOSIT_COMPLETED]: InvestorDepositCompletedPayload;
  [EVENT_NAMES.USER_CREATED]: UserCreatedPayload;
  [EVENT_NAMES.USER_UPDATED]: UserUpdatedPayload;
  [EVENT_NAMES.USER_DEACTIVATED]: UserDeactivatedPayload;
}

// ============================================
// QUEUE NAMES
// ============================================

export const QUEUE_NAMES = {
  EVENTS: "radpro-events",
  NOTIFICATIONS: "radpro-notifications",
  WEBHOOKS: "radpro-webhooks",
  OUTBOX: "radpro-outbox",
  OVERTIME_AUTO_CHECKOUT: "radpro-overtime-auto-checkout",
  ATTENDANCE_AUTO_CHECKOUT: "radpro-attendance-auto-checkout",
  BILLING_SCHEDULE: "radpro-billing-schedule",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ============================================
// JOB PRIORITIES
// ============================================

export const JOB_PRIORITIES = {
  CRITICAL: 1, // Force logout, payment events
  HIGH: 2, // Notifications, urgent alerts
  NORMAL: 3, // Work orders, tickets
  LOW: 4, // Inventory, analytics
} as const;

// ============================================
// EVENT METADATA
// ============================================

export interface EventMetadata {
  name: EventName;
  category: EventCategory;
  priority: number;
  /** Whether this event should be persisted in the outbox */
  persistent: boolean;
  /** Whether this event should be processed asynchronously via BullMQ */
  async: boolean;
}

/** Map event names to their metadata */
export const EVENT_METADATA: Record<EventName, EventMetadata> = {
  [EVENT_NAMES.INVOICE_CREATED]: {
    name: EVENT_NAMES.INVOICE_CREATED,
    category: "billing",
    priority: JOB_PRIORITIES.NORMAL,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.INVOICE_PAID]: {
    name: EVENT_NAMES.INVOICE_PAID,
    category: "billing",
    priority: JOB_PRIORITIES.CRITICAL,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.INVOICE_OVERDUE]: {
    name: EVENT_NAMES.INVOICE_OVERDUE,
    category: "billing",
    priority: JOB_PRIORITIES.HIGH,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.INVOICE_AUTO_ISOLATE_REQUESTED]: {
    name: EVENT_NAMES.INVOICE_AUTO_ISOLATE_REQUESTED,
    category: "billing",
    priority: JOB_PRIORITIES.HIGH,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.INVOICE_REMINDER_DUE]: {
    name: EVENT_NAMES.INVOICE_REMINDER_DUE,
    category: "billing",
    priority: JOB_PRIORITIES.NORMAL,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.PAYMENT_FAILED]: {
    name: EVENT_NAMES.PAYMENT_FAILED,
    category: "billing",
    priority: JOB_PRIORITIES.HIGH,
    persistent: true,
    async: true,
  },

  [EVENT_NAMES.CUSTOMER_CREATED]: {
    name: EVENT_NAMES.CUSTOMER_CREATED,
    category: "customer",
    priority: JOB_PRIORITIES.NORMAL,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.CUSTOMER_UPDATED]: {
    name: EVENT_NAMES.CUSTOMER_UPDATED,
    category: "customer",
    priority: JOB_PRIORITIES.LOW,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.CUSTOMER_SUSPENDED]: {
    name: EVENT_NAMES.CUSTOMER_SUSPENDED,
    category: "customer",
    priority: JOB_PRIORITIES.HIGH,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.CUSTOMER_ACTIVATED]: {
    name: EVENT_NAMES.CUSTOMER_ACTIVATED,
    category: "customer",
    priority: JOB_PRIORITIES.HIGH,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.CUSTOMER_ISOLATED]: {
    name: EVENT_NAMES.CUSTOMER_ISOLATED,
    category: "customer",
    priority: JOB_PRIORITIES.HIGH,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.CUSTOMER_DELETED]: {
    name: EVENT_NAMES.CUSTOMER_DELETED,
    category: "customer",
    priority: JOB_PRIORITIES.HIGH,
    persistent: true,
    async: true,
  },

  [EVENT_NAMES.WORK_ORDER_CREATED]: {
    name: EVENT_NAMES.WORK_ORDER_CREATED,
    category: "work_order",
    priority: JOB_PRIORITIES.NORMAL,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.WORK_ORDER_ASSIGNED]: {
    name: EVENT_NAMES.WORK_ORDER_ASSIGNED,
    category: "work_order",
    priority: JOB_PRIORITIES.HIGH,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.WORK_ORDER_UPDATED]: {
    name: EVENT_NAMES.WORK_ORDER_UPDATED,
    category: "work_order",
    priority: JOB_PRIORITIES.NORMAL,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.WORK_ORDER_COMPLETED]: {
    name: EVENT_NAMES.WORK_ORDER_COMPLETED,
    category: "work_order",
    priority: JOB_PRIORITIES.NORMAL,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.WORK_ORDER_ACTIVITY]: {
    name: EVENT_NAMES.WORK_ORDER_ACTIVITY,
    category: "work_order",
    priority: JOB_PRIORITIES.NORMAL,
    persistent: true,
    async: true,
  },

  [EVENT_NAMES.TICKET_CREATED]: {
    name: EVENT_NAMES.TICKET_CREATED,
    category: "ticket",
    priority: JOB_PRIORITIES.NORMAL,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.TICKET_REPLY]: {
    name: EVENT_NAMES.TICKET_REPLY,
    category: "ticket",
    priority: JOB_PRIORITIES.NORMAL,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.TICKET_STATUS_CHANGED]: {
    name: EVENT_NAMES.TICKET_STATUS_CHANGED,
    category: "ticket",
    priority: JOB_PRIORITIES.NORMAL,
    persistent: true,
    async: true,
  },

  [EVENT_NAMES.INVENTORY_STOCK_IN]: {
    name: EVENT_NAMES.INVENTORY_STOCK_IN,
    category: "inventory",
    priority: JOB_PRIORITIES.LOW,
    persistent: false,
    async: true,
  },
  [EVENT_NAMES.INVENTORY_STOCK_OUT]: {
    name: EVENT_NAMES.INVENTORY_STOCK_OUT,
    category: "inventory",
    priority: JOB_PRIORITIES.LOW,
    persistent: false,
    async: true,
  },
  [EVENT_NAMES.INVENTORY_LOW_STOCK]: {
    name: EVENT_NAMES.INVENTORY_LOW_STOCK,
    category: "inventory",
    priority: JOB_PRIORITIES.HIGH,
    persistent: true,
    async: true,
  },

  [EVENT_NAMES.ATTENDANCE_CHECKIN]: {
    name: EVENT_NAMES.ATTENDANCE_CHECKIN,
    category: "attendance",
    priority: JOB_PRIORITIES.NORMAL,
    persistent: false,
    async: true,
  },
  [EVENT_NAMES.ATTENDANCE_CHECKOUT]: {
    name: EVENT_NAMES.ATTENDANCE_CHECKOUT,
    category: "attendance",
    priority: JOB_PRIORITIES.NORMAL,
    persistent: false,
    async: true,
  },
  [EVENT_NAMES.ATTENDANCE_ABSENT]: {
    name: EVENT_NAMES.ATTENDANCE_ABSENT,
    category: "attendance",
    priority: JOB_PRIORITIES.HIGH,
    persistent: true,
    async: true,
  },

  [EVENT_NAMES.NETWORK_DEVICE_ONLINE]: {
    name: EVENT_NAMES.NETWORK_DEVICE_ONLINE,
    category: "network",
    priority: JOB_PRIORITIES.NORMAL,
    persistent: false,
    async: true,
  },
  [EVENT_NAMES.NETWORK_DEVICE_OFFLINE]: {
    name: EVENT_NAMES.NETWORK_DEVICE_OFFLINE,
    category: "network",
    priority: JOB_PRIORITIES.HIGH,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.NETWORK_RADIUS_UPDATE]: {
    name: EVENT_NAMES.NETWORK_RADIUS_UPDATE,
    category: "network",
    priority: JOB_PRIORITIES.NORMAL,
    persistent: false,
    async: true,
  },

  [EVENT_NAMES.NOTIFICATION_CREATED]: {
    name: EVENT_NAMES.NOTIFICATION_CREATED,
    category: "notification",
    priority: JOB_PRIORITIES.NORMAL,
    persistent: false,
    async: true,
  },
  [EVENT_NAMES.NOTIFICATION_PUSH_SENT]: {
    name: EVENT_NAMES.NOTIFICATION_PUSH_SENT,
    category: "notification",
    priority: JOB_PRIORITIES.LOW,
    persistent: false,
    async: false,
  },
  [EVENT_NAMES.NOTIFICATION_PUSH_FAILED]: {
    name: EVENT_NAMES.NOTIFICATION_PUSH_FAILED,
    category: "notification",
    priority: JOB_PRIORITIES.HIGH,
    persistent: true,
    async: true,
  },

  [EVENT_NAMES.SYSTEM_USER_LOGIN]: {
    name: EVENT_NAMES.SYSTEM_USER_LOGIN,
    category: "system",
    priority: JOB_PRIORITIES.LOW,
    persistent: false,
    async: false,
  },
  [EVENT_NAMES.SYSTEM_USER_LOGOUT]: {
    name: EVENT_NAMES.SYSTEM_USER_LOGOUT,
    category: "system",
    priority: JOB_PRIORITIES.LOW,
    persistent: false,
    async: false,
  },
  [EVENT_NAMES.SYSTEM_ERROR]: {
    name: EVENT_NAMES.SYSTEM_ERROR,
    category: "system",
    priority: JOB_PRIORITIES.CRITICAL,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.PACKAGE_CHANGED]: {
    name: EVENT_NAMES.PACKAGE_CHANGED,
    category: "billing",
    priority: JOB_PRIORITIES.HIGH,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.PROFILE_PPP_UPDATED]: {
    name: EVENT_NAMES.PROFILE_PPP_UPDATED,
    category: "network",
    priority: JOB_PRIORITIES.HIGH,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.EXPENSE_APPROVED]: {
    name: EVENT_NAMES.EXPENSE_APPROVED,
    category: "billing",
    priority: JOB_PRIORITIES.NORMAL,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.PURCHASE_ORDER_PAID]: {
    name: EVENT_NAMES.PURCHASE_ORDER_PAID,
    category: "billing",
    priority: JOB_PRIORITIES.NORMAL,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.SALARY_PROCESSED]: {
    name: EVENT_NAMES.SALARY_PROCESSED,
    category: "salary",
    priority: JOB_PRIORITIES.NORMAL,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.MITRA_WITHDRAWAL_COMPLETED]: {
    name: EVENT_NAMES.MITRA_WITHDRAWAL_COMPLETED,
    category: "billing",
    priority: JOB_PRIORITIES.NORMAL,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.INVESTOR_PAYOUT_COMPLETED]: {
    name: EVENT_NAMES.INVESTOR_PAYOUT_COMPLETED,
    category: "billing",
    priority: JOB_PRIORITIES.NORMAL,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.INVESTOR_DEPOSIT_COMPLETED]: {
    name: EVENT_NAMES.INVESTOR_DEPOSIT_COMPLETED,
    category: "billing",
    priority: JOB_PRIORITIES.NORMAL,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.COUPON_USED]: {
    name: EVENT_NAMES.COUPON_USED,
    category: "billing",
    priority: JOB_PRIORITIES.NORMAL,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.USER_CREATED]: {
    name: EVENT_NAMES.USER_CREATED,
    category: "system",
    priority: JOB_PRIORITIES.NORMAL,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.USER_UPDATED]: {
    name: EVENT_NAMES.USER_UPDATED,
    category: "system",
    priority: JOB_PRIORITIES.LOW,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.USER_DEACTIVATED]: {
    name: EVENT_NAMES.USER_DEACTIVATED,
    category: "system",
    priority: JOB_PRIORITIES.NORMAL,
    persistent: true,
    async: true,
  },
};
