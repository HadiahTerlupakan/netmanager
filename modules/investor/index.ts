// Public API of modules/investor

// Services — admin side
export {
  InvestorAdminService,
  getInvestorAdminService,
  getInvestors,
  createInvestor,
  getInvestorById,
  updateInvestorById,
  toggleInvestorActive,
  deleteInvestorById,
  investorAdminErrorMessages,
} from "./services/InvestorAdminService";
export type {
  SafeInvestor,
  InvestorCreateInput,
  InvestorUpdateInput,
  ServiceResult as InvestorAdminServiceResult,
} from "./services/InvestorAdminService";

export {
  InvestorPayoutAdminService,
  getInvestorPayoutAdminService,
} from "./services/InvestorPayoutAdminService";
export type {
  InvestorPayoutListInput,
  InvestorPayoutCreateInput,
} from "./services/InvestorPayoutAdminService";

// Services — portal side
export {
  InvestorPortalAuthService,
  getInvestorPortalAuthService,
} from "./services/InvestorPortalAuthService";
export type {
  InvestorLoginInput,
  InvestorLoginResult,
  InvestorTokenPayload,
} from "./services/InvestorPortalAuthService";

export {
  InvestorPortalDashboardService,
  getInvestorPortalDashboardService,
} from "./services/InvestorPortalDashboardService";

export {
  InvestorPortalProjectService,
  getInvestorPortalProjectService,
} from "./services/InvestorPortalProjectService";

export {
  InvestorPortalPayoutService,
  getInvestorPortalPayoutService,
} from "./services/InvestorPortalPayoutService";

export {
  InvestorPortalKeuanganService,
  getInvestorPortalKeuanganService,
} from "./services/InvestorPortalKeuanganService";
export type {
  InvestorPortalDeposit,
  InvestorPortalProfitShare,
} from "./services/InvestorPortalKeuanganService";

// Services — autentikasi aplikasi mobile
export {
  MobileInvestorAuthService,
  getMobileInvestorAuthService,
  tryMobileInvestorLogin,
} from "./services/MobileInvestorAuthService";
export type {
  MobileInvestorLoginInput,
  MobileInvestorLoginResult,
  MobileInvestorProfile,
} from "./services/MobileInvestorAuthService";

// Push notifikasi ke aplikasi mobile investor
export {
  InvestorPushService,
  getInvestorPushService,
} from "./services/InvestorPushService";
export type { AksiFcmToken } from "./services/InvestorPushService";
export { handleInvestorNotification } from "./services/event-handlers/investor-notification.handler";

// Services — deposit, balance, profit share, config
export { InvestorDepositService } from "./services/InvestorDepositService";
export { InvestorBalanceService } from "./services/InvestorBalanceService";
export type { InvestorBalance } from "./services/InvestorBalanceService";
export { InvestorProfitShareService } from "./services/InvestorProfitShareService";
export { InvestorConfigService } from "./services/InvestorConfigService";

// Factory functions (pre-wired)
import { InvestorDepositService } from "./services/InvestorDepositService";
import { InvestorBalanceService } from "./services/InvestorBalanceService";
import { InvestorProfitShareService } from "./services/InvestorProfitShareService";
import { InvestorConfigService } from "./services/InvestorConfigService";

export function getInvestorDepositService() {
  return new InvestorDepositService();
}
export function getInvestorBalanceService() {
  return new InvestorBalanceService();
}
export function getInvestorProfitShareService() {
  return new InvestorProfitShareService();
}
export function getInvestorConfigService() {
  return new InvestorConfigService();
}
