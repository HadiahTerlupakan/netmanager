export type ResellerStatus = "ACTIVE" | "INACTIVE";

export type Reseller = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly status: ResellerStatus;
  readonly notes: string | null;
};

export type ResellerOutlet = {
  readonly id: string;
  readonly resellerId: string;
  readonly code: string;
  readonly name: string;
  readonly phone: string | null;
  readonly address: string | null;
  readonly status: ResellerStatus;
};

export type ResellerPackagePrice = {
  readonly id: string;
  readonly hargaPaketId: string;
  readonly price: number;
  readonly status: ResellerStatus;
  readonly startsAt: string;
  readonly endsAt: string | null;
};

export type ResellerCommission = {
  readonly id: string;
  readonly invoiceId: string;
  readonly pelangganId: string;
  readonly commissionAmount: number;
  readonly status: "ACCRUED" | "SETTLED" | "PAID";
  readonly period: string;
  readonly accruedAt: string;
};

export type ApiListResponse<T> = {
  readonly data?: readonly T[];
  readonly pagination?: { readonly total?: number };
};

export type ResellerForm = {
  readonly code: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly address: string;
  readonly notes: string;
  readonly status: ResellerStatus;
};

export type OutletForm = {
  readonly code: string;
  readonly name: string;
  readonly phone: string;
  readonly address: string;
  readonly status: ResellerStatus;
};

export const emptyResellerForm: ResellerForm = {
  code: "",
  name: "",
  email: "",
  phone: "",
  address: "",
  notes: "",
  status: "ACTIVE",
};

export const emptyOutletForm: OutletForm = {
  code: "",
  name: "",
  phone: "",
  address: "",
  status: "ACTIVE",
};
