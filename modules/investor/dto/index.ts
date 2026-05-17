/**
 * Public DTOs untuk module investor.
 * Re-export dari service files agar konsumen bisa import dari sub-entrypoint
 * `@/modules/investor/dto` tanpa tahu internal layout services.
 */
export type {
  InvestorPayoutListInput,
  InvestorPayoutCreateInput,
} from "../services/InvestorPayoutAdminService";
export type {
  InvestorLoginInput,
  InvestorLoginResult,
  InvestorTokenPayload,
} from "../services/InvestorPortalAuthService";
export type {
  SafeInvestor,
  InvestorCreateInput,
  InvestorUpdateInput,
  ServiceResult,
} from "../services/InvestorAdminService";
