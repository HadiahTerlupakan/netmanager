import type { AxiosInstance } from "axios";
import type { MixRadiusCustomer } from "./mixradius-types";

export type MixRadiusCustomerCacheState = {
  data: MixRadiusCustomer[];
  expiresAt: number;
};

export type MixRadiusCustomerClientParams = {
  client: AxiosInstance;
  baseUrl: string;
  login: () => Promise<void>;
  onSessionExpired: () => void;
  randomDelay: (min?: number, max?: number) => Promise<void>;
};

export type MixRadiusInvoiceCount = {
  paidCount: number;
  totalCount: number;
};

export type MixRadiusInvoiceCountCacheValue = MixRadiusInvoiceCount & {
  lastRenewedOn: string;
};
