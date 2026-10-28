export type SamplePackage = { name: string; speed: string; price: number };

/** Jalan bernama dari OpenStreetMap beserta wilayah tempatnya berada. */
export type SampleStreet = {
  name: string;
  village?: string;
  district?: string;
  city?: string;
};

export type PpnMode = "none" | "inclusive" | "exclusive";

export type PayDateRule = { mode: "random" } | { mode: "fixed"; day: number };

export type SampleIssuer = { name: string; address: string; phone: string };

export type SampleGenerateInput = {
  mitraId: string;
  mitraName: string;
  issuer: SampleIssuer;
  packages: SamplePackage[];
  customerCount: number;
  /** "YYYY-MM" */
  fromMonth: string;
  /** "YYYY-MM" */
  toMonth: string;
  center: { lat: number; lng: number };
  radiusM: number;
  dueDay: number;
  payDate: PayDateRule;
  ppn: PpnMode;
  streets: SampleStreet[];
};

export type PaymentMethod = "Transfer bank" | "QRIS" | "E-wallet" | "Tunai";

export type SampleCustomer = {
  code: string;
  name: string;
  address: string;
  phoneMasked: string;
  packageIndex: number;
};

/** Tanggal berbentuk "YYYY-MM-DD". */
export type SampleInvoice = {
  number: string;
  customerIndex: number;
  month: string;
  dueDate: string;
  paidDate: string;
  method: PaymentMethod;
  dpp: number;
  ppn: number;
  total: number;
};

export type SampleSet = {
  customers: SampleCustomer[];
  invoices: SampleInvoice[];
};
