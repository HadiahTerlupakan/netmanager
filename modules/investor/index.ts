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
