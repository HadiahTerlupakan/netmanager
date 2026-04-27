// Public API for Pelanggan Module

// Domain
export type * from "./domain/entities/PelangganEntity";
export type * from "./domain/entities/SupportTicketEntity";
export type * from "./domain/entities/CustomerUsageEntity";
export type * from "./domain/ports/IPelangganRepository";
export type * from "./domain/ports/ICustomerTicketRepository";
export type * from "./domain/ports/ICustomerUsageRepository";

// Core Repository & Service
export { PelangganRepository } from "./repositories/PelangganRepository";
export type {
  CreatePelangganDTO,
  PelangganWithPackage,
  FilterOptions,
} from "./repositories/PelangganRepository";

export {
  PelangganService,
  getPelangganService,
} from "./services/PelangganService";
export type { CreatePelangganInput } from "./services/PelangganService";

// Customer Portal Repositories
export { CustomerInvoiceRepository } from "./repositories/CustomerInvoiceRepository";
export { CustomerTicketRepository } from "./repositories/CustomerTicketRepository";
export { CustomerUsageRepository } from "./repositories/CustomerUsageRepository";

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

// Validators
export * from "./validators/support-ticket";
export * from "./validators/pelanggan";
