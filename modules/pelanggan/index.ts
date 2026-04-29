// Public API for Pelanggan Module

// Core Service
export {
  PelangganService,
  getPelangganService,
} from "./services/PelangganService";
export type { CreatePelangganInput } from "./services/PelangganService";

// Customer Portal Services
export { SupportTicketService } from "./services/SupportTicketService";
export { CustomerUsageService } from "./services/CustomerUsageService";
export { CustomerAuthService } from "./services/CustomerAuthService";
export {
  CustomerPortalService,
  getCustomerPortalService,
} from "./services/CustomerPortalService";
export * from "./services/CustomerPaymentRouteService";
export * from "./services/CustomerLegacyBillingService";
export * from "./services/CustomerPaymentReceiptService";
export * from "./services/SupportTicketUploadService";
export * from "./services/CustomerPaymentStatusStreamService";
export {
  CustomerPackageService,
  getCustomerPackageService,
} from "./services/CustomerPackageService";
export { CustomerDashboardService } from "./services/dashboard/CustomerDashboardService";
export type {
  CustomerDashboardBillingData,
  CustomerDashboardConnectionData,
  CustomerDashboardProfileData,
  CustomerDashboardViewModel,
} from "./services/dashboard/customer-dashboard.contracts";
export { PelangganBillingBridgeService } from "./services/PelangganBillingBridgeService";
export { PelangganPushTokenService } from "./services/PelangganPushTokenService";
export {
  CustomerNotificationService,
  getCustomerNotificationService,
} from "./services/CustomerNotificationService";

// Admin Services
export * from "./services/AdminSupportTicketService";
export * from "./services/AdminSupportTicketRouteService";
export * from "./services/AdminCustomerInvoiceRouteService";
export * from "./services/PelangganAdminQueryService";
export * from "./services/PelangganAdminMutationService";
export * from "./services/PelangganPppRouteService";
export { createPelangganSchema } from "./validators/pelanggan";
export type { CreatePelangganSchema } from "./validators/pelanggan";
export {
  supportTicketCreateSchema,
  supportTicketFilterSchema,
  supportTicketUpdateSchema,
} from "./validators/support-ticket";
export type {
  SupportTicketCreate,
  SupportTicketFilter,
  SupportTicketUpdate,
} from "./validators/support-ticket";
