import { vi } from "vitest";

/**
 * Data tiruan halaman /tagihan. Berkas tes memasang `vi.mock` sendiri yang
 * membaca objek `tagihanApi` di sini, lalu mengubahnya per kasus uji.
 */

type Row = Record<string, unknown>;

export const METODE_BCA = {
  id: "BC",
  name: "BCA Virtual Account",
  provider: "DUITKU",
  type: "VA",
  code: "BC",
  group: "Virtual Account",
};

export const METODE_BRI = {
  id: "BR",
  name: "BRI Virtual Account",
  provider: "DUITKU",
  type: "VA",
  code: "BR",
  group: "Virtual Account",
};

export const REKENING_BCA = {
  id: "manual_bank-1",
  name: "BCA",
  provider: "MANUAL",
  type: "MANUAL",
  code: "MANUAL_bank-1",
  group: "Transfer Manual",
  details: {
    bankName: "BCA",
    accountName: "PT Radpro Net",
    accountNumber: "1234567890",
  },
};

export const tagihanApi = {
  invoices: [] as Row[],
  methods: [] as Row[],
  methodsError: null as Error | null,
  methodsLoading: false,
  saldoKredit: undefined as number | undefined,
  methodsUrls: [] as string[],
  refetchInvoices: vi.fn(async (): Promise<unknown> => undefined),
  refetchMethods: vi.fn(async (): Promise<unknown> => undefined),
};

export const router = { push: vi.fn(), back: vi.fn(), replace: vi.fn() };

export function resetTagihanApi() {
  tagihanApi.invoices = [];
  tagihanApi.methods = [METODE_BCA, METODE_BRI];
  tagihanApi.methodsError = null;
  tagihanApi.methodsLoading = false;
  tagihanApi.saldoKredit = undefined;
  tagihanApi.methodsUrls = [];
  tagihanApi.refetchInvoices.mockClear();
  tagihanApi.refetchMethods.mockClear();
  router.push.mockClear();
  router.back.mockClear();
}

export function useInfiniteApiTiruan() {
  return {
    items: tagihanApi.invoices,
    error: null as Error | null,
    isLoading: false,
    refetch: tagihanApi.refetchInvoices,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  };
}

export function useApiTiruan(url: string | null) {
  if (url?.startsWith("/api/customer/payment-methods")) {
    tagihanApi.methodsUrls.push(url);
    return {
      data: tagihanApi.methodsError ? undefined : tagihanApi.methods,
      error: tagihanApi.methodsError,
      isLoading: tagihanApi.methodsLoading,
      refetch: tagihanApi.refetchMethods,
    };
  }
  if (url === "/api/customer/profile") {
    return {
      data: { profile: { saldoKredit: tagihanApi.saldoKredit } },
      error: null as Error | null,
      isLoading: false,
      refetch: vi.fn(),
    };
  }
  return { data: undefined, error: null, isLoading: false, refetch: vi.fn() };
}

export function buatInvoice(overrides: Row = {}): Row {
  return {
    id: "invoice-1",
    invoiceNumber: "INV-001",
    totalAmount: 100000,
    remainingAmount: 100000,
    status: "SENT",
    dueDate: "2026-11-01T00:00:00.000Z",
    issueDate: "2026-10-01T00:00:00.000Z",
    items: [{ description: "Internet 20 Mbps" }],
    lastPayment: null,
    ...overrides,
  };
}

/** Checkout VA Duitku yang menunggu dibayar. */
export function checkoutVa(overrides: Row = {}): Row {
  return {
    id: "pay-1",
    amount: 100000,
    date: "2026-10-31T09:00:00.000Z",
    method: "OTHER",
    gatewayStatus: "PENDING",
    gatewayProvider: "BC",
    vaNumber: "7007014006305775",
    qrString: null,
    paymentUrl: "https://sandbox.duitku.com/pay/abc",
    expiresAt: "2099-01-01T00:00:00.000Z",
    accountId: null,
    receiptUrl: null,
    ...overrides,
  };
}

/** Transfer bank manual ke rekening BCA yang menunggu bukti/verifikasi. */
export function transferManual(overrides: Row = {}): Row {
  return {
    id: "pay-m1",
    amount: 100000,
    date: "2026-10-31T09:00:00.000Z",
    method: "BANK_TRANSFER",
    gatewayStatus: "PENDING",
    gatewayProvider: null,
    vaNumber: null,
    qrString: null,
    paymentUrl: null,
    expiresAt: null,
    accountId: "bank-1",
    receiptUrl: null,
    isManual: true,
    ...overrides,
  };
}

/** EventSource tiruan: jsdom tidak menyediakannya. */
export class EventSourceDiam {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  close() {}
}
