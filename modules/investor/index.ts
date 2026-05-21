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

// Services — deposit, balance, profit share, config
export { InvestorDepositService } from "./services/InvestorDepositService";
export { InvestorBalanceService } from "./services/InvestorBalanceService";
export type { InvestorBalance } from "./services/InvestorBalanceService";
export { InvestorProfitShareService } from "./services/InvestorProfitShareService";
export { InvestorConfigService } from "./services/InvestorConfigService";

// Repositories
export { InvestorDepositRepository } from "./repositories/InvestorDepositRepository";
export { InvestorConfigRepository } from "./repositories/InvestorConfigRepository";
export { InvestorProfitShareRepository } from "./repositories/InvestorProfitShareRepository";

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
