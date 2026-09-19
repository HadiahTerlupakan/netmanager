// Public API for Pelanggan Module

export type {
  CreatePelangganDTO,
  PelangganDetailDTO,
  PelangganListItemDTO,
  PelangganOptionDTO,
  PelangganPortalDTO,
  PaymentHistoryItemDTO,
  UpdateProfileDTO,
} from "./dto/PelangganDTO";
export type {
  CreateTicketDTO,
  ReplyTicketDTO,
  TicketAttachmentDTO,
  TicketDetailDTO,
  TicketListItemDTO,
  TicketMessageDTO,
  TicketPortalDTO,
  UpdateTicketDTO,
} from "./dto/SupportTicketDTO";

export {
  PelangganService,
  getPelangganService,
} from "./services/PelangganService";
export {
  PelangganInputBuilderService,
  pelangganInputBuilderService,
} from "./services/pelanggan-input-builder.service";
export {
  PelangganUploadService,
  pelangganUploadService,
} from "./services/pelanggan-upload.service";

export { SupportTicketService } from "./services/SupportTicketService";
export { CustomerUsageService } from "./services/CustomerUsageService";
export { CustomerAuthService } from "./services/CustomerAuthService";
export {
  CustomerPortalService,
  getCustomerPortalService,
} from "./services/CustomerPortalService";
export { createCustomerPaymentForRoute } from "./services/CustomerPaymentRouteService";
export {
  CustomerLegacyBillingError,
  CustomerLegacyBillingService,
} from "./services/CustomerLegacyBillingService";
export { uploadCustomerPaymentReceipt } from "./services/CustomerPaymentReceiptService";
export {
  SupportTicketUploadService,
  supportTicketUploadService,
  type SupportTicketUploadResult,
} from "./services/SupportTicketUploadService";
export { getCustomerPaymentStreamStatus } from "./services/CustomerPaymentStatusStreamService";
export {
  CustomerPackageService,
  getCustomerPackageService,
} from "./services/CustomerPackageService";

export {
  CustomerPackageUpgradeService,
  CustomerPackageUpgradeError,
  getCustomerPackageUpgradeService,
} from "./services/CustomerPackageUpgradeService";
export { CustomerDashboardService } from "./services/dashboard/CustomerDashboardService";
export { PelangganBillingBridgeService } from "./services/PelangganBillingBridgeService";
export { PelangganPushTokenService } from "./services/PelangganPushTokenService";
export {
  PelangganContactService,
  pelangganContactService,
  type PelangganContactSnapshot,
} from "./services/PelangganContactService";
export {
  CustomerNotificationService,
  getCustomerNotificationService,
} from "./services/CustomerNotificationService";

export {
  createPelangganSchema,
  updatePelangganProfileSchema,
  type CreatePelangganSchema,
  supportTicketCreateSchema,
  supportTicketFilterSchema,
  supportTicketUpdateSchema,
  type SupportTicketCreate,
  type SupportTicketFilter,
  type SupportTicketUpdate,
} from "./validation";

export {
  AdminSupportTicketService,
  getAdminSupportTicketService,
} from "./services/AdminSupportTicketService";
export {
  AdminSupportTicketRouteService,
  getAdminSupportTicketRouteService,
} from "./services/AdminSupportTicketRouteService";
export { AdminCustomerInvoiceRouteService } from "./services/AdminCustomerInvoiceRouteService";
export { PelangganAdminQueryService } from "./services/PelangganAdminQueryService";
export {
  PelangganAdminMutationError,
  PelangganAdminMutationService,
} from "./services/PelangganAdminMutationService";
export {
  PelangganPppRouteService,
  RouteServiceError,
} from "./services/PelangganPppRouteService";
export {
  listMobilePelanggan,
  SiteAccessDeniedError,
  type MobilePelangganDTO,
} from "./services/MobilePelangganService";

// Event handlers — exposed via public API supaya lib/event-bus tidak
// import path internal services/.
export { handleInvoiceAutoIsolate } from "./services/event-handlers/invoice-auto-isolate.handler";
export { handleInvoicePaidActivation } from "./services/event-handlers/invoice-paid-activation.handler";
