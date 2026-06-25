export {
  createNotification,
  getNotificationsForUser,
  getReadableNotificationForUser,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
  notifyAdminsAboutMobileAction,
  notifyHolidayCreated,
  notifyNewCanvasing,
  notifyNewPointClaim,
  notifyNewWorkOrder,
  notifyWorkOrderAssigned,
  notifyWorkOrderStatusChange,
  notifyWorkOrderUpdate,
  type CanvasingNotificationData,
  type CreateNotificationData,
  type HolidayNotificationData,
  type NotificationPriority,
  type NotificationType,
  type PointClaimNotificationData,
  type WorkOrderNotificationData,
} from "./services/NotificationService";
export {
  getMobileNotifications,
  handleMobileNotificationAction,
  parseMobileNotificationPagination,
  resolveMobileNotificationSiteId,
} from "./services/MobileNotificationRouteService";
export { AdminNotificationMonitoringRouteService } from "./services/AdminNotificationMonitoringRouteService";
export {
  getPelangganNotificationHistory,
  PelangganNotFoundError,
  type NotificationHistoryEntry,
  type NotificationHistoryResult,
} from "./services/NotificationHistoryService";
export {
  listNotificationDeadLetters,
  resolveDeadLetter,
  retryDeadLetter,
  normalizeDeadLetterPage,
  normalizeDeadLetterLimit,
  DeadLetterNotFoundError,
  DeadLetterAccessDeniedError,
  DeadLetterAlreadyResolvedError,
  DeadLetterInvalidTemplateError,
  DeadLetterInvalidChannelError,
  type DeadLetterListParams,
  type DeadLetterListResult,
} from "./services/DeadLetterService";
export {
  listEmailDeliveryLogs,
  normalizeEmailLogPage,
  normalizeEmailLogLimit,
  EmailLogSearchTooLongError,
  type EmailLogListParams,
  type EmailLogListResult,
} from "./services/EmailLogQueryService";
export {
  maskEmailAddress,
  toEmailDeliveryLogDTO,
  type EmailDeliveryLogDTO,
  type EmailLogStatus,
} from "./dto/EmailDeliveryLogDTO";
export {
  cleanupExpiredNotificationLogs,
  NOTIFICATION_LOGS_CLEANUP_CONFIG,
  type NotificationLogsCleanupResult,
} from "./services/NotificationLogsCleanupService";
export {
  AnnouncementService,
  AnnouncementServiceError,
  announcementService,
} from "./services/AnnouncementService";
export {
  MobileFcmTokenError,
  updateMobileFcmToken,
} from "./services/MobileFcmTokenService";
export {
  registerMobilePushToken,
  removeMobilePushToken,
} from "./services/MobilePushTokenRouteService";
export { submitMobileErrorReport } from "./services/MobileErrorReportService";
export {
  clearStaleFcmTokens,
  cleanupStaleFcmTokenArrays,
} from "./services/MobileFcmTokenCleanupService";
export { WhatsAppApprovalButtonService } from "./services/WhatsAppApprovalButtonService";
export {
  EmailService,
  type EmailConfig,
  type SendEmailParams,
  type SendEmailResult,
} from "./services/email-service";
export {
  classifyEmailError,
  type EmailErrorCategory,
  type ClassifiedEmailError,
} from "./services/email-error-classifier";
export {
  sendCustomerPushNotification,
  sendPushNotification,
  sendPushToUsers,
  sendPushForNotification,
  sendPushToDepartment,
} from "./services/ExpoPushService";
export {
  enqueuePushRetry,
  requeueStuckProcessingItems,
} from "./services/PushRetryQueue";
export { WhatsAppService } from "./services/whatsapp/whatsapp-service";
export { NotificationDispatcher } from "./services/NotificationDispatcher";
export type {
  NotificationChannel,
  NotificationDispatchInput,
} from "./services/NotificationDispatcher";
export { resolveCustomerContact } from "./services/channel-router";
export type { CustomerContact } from "./services/channel-router";
export { BILLING_TEMPLATES } from "./templates/billing-templates";
export type {
  BillingTemplateKey,
  BillingTemplateParams,
} from "./templates/billing-templates";

// Multi-WhatsApp Support - Services only (no repository exports)
export { WhatsAppAccountService } from "./services/whatsapp-account.service";
export { WhatsAppSenderService } from "./services/whatsapp-sender.service";

// Domain types
export type {
  WhatsAppAccount,
  WhatsAppAccountCreateInput,
  WhatsAppAccountUpdateInput,
} from "./domain/whatsapp-account.entity";
export type {
  WhatsAppMessage,
  WhatsAppMessageStatus,
} from "./domain/whatsapp-message.entity";

// DTOs
export type { CreateWhatsAppAccountDTO } from "./dto/create-whatsapp-account.dto";
export type { UpdateWhatsAppAccountDTO } from "./dto/update-whatsapp-account.dto";
export type {
  SendWhatsAppMessageDTO,
  BroadcastWhatsAppMessageDTO,
} from "./dto/send-whatsapp-message.dto";

// Validation schemas
export { CreateWhatsAppAccountSchema } from "./dto/create-whatsapp-account.dto";
export { UpdateWhatsAppAccountSchema } from "./dto/update-whatsapp-account.dto";
export {
  SendWhatsAppMessageSchema,
  BroadcastWhatsAppMessageSchema,
} from "./dto/send-whatsapp-message.dto";

// Event handlers — exposed via public API supaya lib/event-bus tidak
// import path internal services/.
export { handleCustomerNotification } from "./services/event-handlers/customer-notification.handler";
export { handleInvoiceNotification } from "./services/event-handlers/invoice-notification.handler";

// Validators (Zod) — public agar API route bisa pakai tanpa langgar
// no-restricted-imports.
export {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  ANNOUNCEMENT_TARGETS,
  type CreateAnnouncementInput,
  type UpdateAnnouncementInput,
  type AnnouncementTarget,
} from "./validators/announcementValidator";
