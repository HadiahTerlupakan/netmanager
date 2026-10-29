/** Biaya tambahan bulanan yang ikut di setiap invoice paketnya. */
export type SampleAddon = { name: string; price: number };

/** Potongan bulanan: nominal Rupiah, atau persen dari harga paket + add-on. */
export type SampleDiscount = {
  name: string;
  kind: "amount" | "percent";
  value: number;
};

/** `addons` dan `discount` boleh tidak ada: batch lama tidak punya field ini. */
export type SamplePackage = {
  name: string;
  speed: string;
  price: number;
  addons?: SampleAddon[];
  discount?: SampleDiscount;
};

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
