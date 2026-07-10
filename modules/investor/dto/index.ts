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

/** Item investor untuk list admin (dengan count proyek). */
export interface InvestorListItem {
  id: string;
  username: string;
  namaLengkap: string;
  email: string | null;
  noTelp: string | null;
  perusahaan: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: {
    rabProjects: number;
    payouts?: number;
  };
}

/** Item proyek RAB yang didanai investor (untuk detail view). */
export interface InvestorRabProjectItem {
  id: string;
  profitSharePercent: number;
  investmentAmount: number | string;
  rabProject?: {
    name: string;
    site?: {
      name: string;
    };
  };
}

/** Entry payout investor (untuk detail view). */
export interface InvestorPayoutEntry {
  id: string;
  amount: string | number;
  date: string | Date;
  bankName?: string | null;
  status: string;
}

/** Detail investor meliputi list proyek & payout. */
export interface InvestorDetail extends InvestorListItem {
  rabProjects?: InvestorRabProjectItem[];
  payouts?: InvestorPayoutEntry[];
}
