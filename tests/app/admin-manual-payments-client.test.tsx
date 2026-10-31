// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bongkarPanggung,
  cari,
  klikTombol,
  pasangPanggung,
  render,
  responsJson,
  tungguSampai,
  type Panggung,
} from "./presurvei-jsdom-harness";

const palsu = vi.hoisted(() => ({
  useApi: vi.fn(),
  toast: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  payments: [] as unknown[],
}));

vi.mock("@/lib/hooks/useApi", () => ({ useApi: palsu.useApi }));
vi.mock("@/lib/hooks/useInvalidate", () => ({
  useInvalidateInvoicePaymentRelated: () => vi.fn(),
}));
vi.mock("react-hot-toast", () => ({
  toast: Object.assign(palsu.toast, {
    success: palsu.toastSuccess,
    error: palsu.toastError,
  }),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

import ManualPaymentClient from "@/app/admin/finance/manual-payments/ManualPaymentClient";

const PERINGATAN_LUNAS =
  "Tagihan sudah lunas — menyetujui akan dikreditkan ke saldo";

const bukti = (overrides: Record<string, unknown> = {}) => ({
  id: "pay-1",
  amount: "100000",
  method: "BANK_TRANSFER",
  status: "PENDING",
  gatewayStatus: "PENDING",
  receiptUrl: "/receipts/bukti.webp",
  createdAt: "2026-10-31T03:00:00.000Z",
  customerName: "Budi",
  notes: null as string | null,
  checkoutTotal: "100000",
  checkoutInvoiceNumbers: ["INV/2026/10/28-AAA"],
  settlementWarning: null as string | null,
  invoice: {
    id: "inv-1",
    invoiceNumber: "INV/2026/10/28-AAA",
    pelangganId: "pel-1",
    totalAmount: "100000",
    status: "SENT",
  },
  ...overrides,
});

let panggung: Panggung;

beforeEach(() => {
  vi.clearAllMocks();
  panggung = pasangPanggung();
  palsu.useApi.mockImplementation((url: string) => ({
    data: url.startsWith("/api/admin/payments/pending-manual")
      ? palsu.payments
      : { sites: [] },
    isLoading: false,
  }));
});

afterEach(async () => {
  await bongkarPanggung(panggung);
  vi.unstubAllGlobals();
});

describe("verifikasi pembayaran manual", () => {
  // Bukti yang masih menunggu untuk tagihan yang sudah dilunasi lewat jalur
  // lain: menyetujuinya tidak melunasi tagihan itu lagi.
  it("menandai bukti untuk tagihan yang sudah lunas sebelum disetujui", async () => {
    palsu.payments = [bukti({ settlementWarning: PERINGATAN_LUNAS })];

    await render(panggung, <ManualPaymentClient />);
    expect(document.body.textContent).toContain("Tagihan sudah lunas");

    await klikTombol("Verifikasi");

    expect(cari('[role="alert"]')?.textContent).toContain(PERINGATAN_LUNAS);
    expect(document.body.textContent).toContain("Setujui Pembayaran");
    expect(document.body.textContent).not.toContain("Setujui & Lunasi Tagihan");
  });

  it("menampilkan ke mana uangnya pergi setelah disetujui", async () => {
    palsu.payments = [bukti({ settlementWarning: PERINGATAN_LUNAS })];
    const peringatan =
      "Tagihan INV/2026/10/28-AAA sudah lunas; Rp 100.000 dikreditkan ke saldo kredit pelanggan.";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        responsJson(200, {
          success: true,
          data: { success: true, warnings: [peringatan] },
        }),
      ),
    );

    await render(panggung, <ManualPaymentClient />);
    await klikTombol("Verifikasi");
    await klikTombol("Setujui Pembayaran");
    await tungguSampai(
      () => palsu.toast.mock.calls.length > 0,
      "peringatan pelunasan ditampilkan",
    );

    expect(palsu.toast).toHaveBeenCalledWith(
      peringatan,
      expect.objectContaining({ duration: 12000 }),
    );
  });

  // Struk satu transfer menutup semua tagihan checkout-nya.
  it("membandingkan bukti dengan total checkout, bukan bagian satu tagihan", async () => {
    palsu.payments = [
      bukti({
        amount: "100000",
        checkoutTotal: "150000",
        checkoutInvoiceNumbers: ["INV/A", "INV/B"],
      }),
    ];

    await render(panggung, <ManualPaymentClient />);
    await klikTombol("Verifikasi");

    expect(document.body.textContent).toContain("Total Transfer (2 tagihan)");
    expect(document.body.textContent).toContain("Rp 150.000");
    expect(document.body.textContent).toContain("INV/A, INV/B");
  });
});
