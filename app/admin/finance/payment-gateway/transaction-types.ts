export type GatewayDisplayStatus =
  | "MENUNGGU"
  | "LUNAS"
  | "KEDALUWARSA"
  | "GAGAL"
  | "DIGANTI_METODE"
  | "DITUTUP_LUNAS"
  | "DIBATALKAN";

export interface GatewayTransaction {
  id: string;
  checkoutId: string | null;
  pelangganId: string;
  customerName: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceStatus: string | null;
  amount: number;
  discountAmount: number;
  gateway: string;
  methodCode: string | null;
  methodName: string | null;
  gatewayStatus: string | null;
  status: GatewayDisplayStatus;
  reference: string | null;
  transactionId: string | null;
  vaNumber: string | null;
  paymentUrl: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GatewayTransactionsResponse {
  items: GatewayTransaction[];
  total: number;
  page: number;
  limit: number;
  summary: Array<{ status: string; count: number; amount: number }>;
}

export const STATUS_STYLE: Record<
  GatewayDisplayStatus,
  { label: string; className: string }
> = {
  MENUNGGU: {
    label: "Menunggu bayar",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  },
  LUNAS: {
    label: "Lunas",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  },
  KEDALUWARSA: {
    label: "Kedaluwarsa",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
  GAGAL: {
    label: "Gagal",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  },
  DIGANTI_METODE: {
    label: "Diganti metode",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  },
  DITUTUP_LUNAS: {
    label: "Ditutup (lunas cara lain)",
    className:
      "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  },
  DIBATALKAN: {
    label: "Dibatalkan",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
};

/** Status mentah di database untuk filter dan ringkasan. */
export const RAW_STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu",
  PAID: "Lunas",
  EXPIRED: "Kedaluwarsa",
  FAILED: "Gagal",
  CANCELLED: "Dibatalkan / diganti",
};

export const formatRupiah = (value: number) =>
  `Rp ${Math.round(value).toLocaleString("id-ID")}`;

export const formatDateTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      })
    : "-";
