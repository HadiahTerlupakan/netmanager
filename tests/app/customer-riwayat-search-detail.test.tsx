// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/components/customer/CustomerAuthProvider", () => ({
  useCustomerAuth: () => ({ isLoading: false, isAuthenticated: true }),
}));

const riwayat = vi.hoisted(() => ({
  invoices: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/hooks/useApi", () => ({
  useApi: () => ({
    data: { invoices: riwayat.invoices },
    isLoading: false,
  }),
}));

import CustomerHistoryPage from "@/app/(customer)/riwayat/page";
import { click, getButton, pressKey, typeInto } from "../helpers/portal-dom";

const LUNAS = {
  id: "inv-1",
  invoiceNumber: "INV/2026/10/001",
  status: "PAID",
  totalAmount: 135000,
  discountAmount: 15000,
  paidAmount: 135000,
  remainingAmount: 0,
  issueDate: "2026-10-01T00:00:00.000Z",
  dueDate: "2026-10-10T00:00:00.000Z",
  items: [{ description: "Internet 20 Mbps Oktober 2026" }],
  lastPayment: {
    id: "pay-1",
    amount: 135000,
    date: "2026-10-12T03:00:00.000Z",
    method: "BANK_TRANSFER",
    accountId: "bank-1",
    gatewayStatus: "PAID",
    isManual: true,
  },
};

const BELUM_BAYAR = {
  id: "inv-2",
  invoiceNumber: "INV/2026/11/002",
  status: "SENT",
  totalAmount: 150000,
  discountAmount: 0,
  paidAmount: 0,
  remainingAmount: 150000,
  issueDate: "2026-11-01T00:00:00.000Z",
  dueDate: "2026-11-10T00:00:00.000Z",
  items: [{ description: "Upgrade paket 50 Mbps" }],
  lastPayment: null as null,
};

function teks(element: Element | null = document.body) {
  return (element?.textContent ?? "").replace(/ /g, " ");
}

function dialog() {
  return document.querySelector<HTMLElement>('[role="dialog"]');
}

describe("halaman riwayat pelanggan: cari dan rincian", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(async () => {
    riwayat.invoices = [LUNAS, BELUM_BAYAR];
    router.back.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<CustomerHistoryPage />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  function kotakCari() {
    return container.querySelector<HTMLInputElement>('input[type="search"]')!;
  }

  // Kotak cari dulu tidak terhubung ke apa pun.
  describe("kotak cari", () => {
    it("menyaring berdasarkan nomor tagihan", async () => {
      await typeInto(kotakCari(), "11/002");

      expect(teks(container)).toContain("INV/2026/11/002");
      expect(teks(container)).not.toContain("INV/2026/10/001");
    });

    it("menyaring berdasarkan keterangan, tanpa peduli huruf besar", async () => {
      await typeInto(kotakCari(), "upgrade");

      expect(teks(container)).toContain("Upgrade paket 50 Mbps");
      expect(teks(container)).not.toContain("Internet 20 Mbps");
    });

    it("pencarian tanpa hasil diberi pesan sendiri", async () => {
      await typeInto(kotakCari(), "tidak-ada");

      expect(teks(container)).toContain(
        "Tidak ada tagihan yang cocok dengan pencarian",
      );
    });

    it("punya nama yang terbaca", () => {
      expect(kotakCari().getAttribute("aria-label")).toBe("Cari tagihan");
    });
  });

  it("tagihan lunas menyebut tanggal dan metode bayarnya", () => {
    const baris = getButton("INV/2026/10/001", container);

    expect(teks(baris)).toContain("Dibayar 12 Okt 2026");
    expect(teks(baris)).toContain("Transfer bank manual");
  });

  // Baris tampak bisa diketuk tetapi dulu tidak melakukan apa pun.
  describe("rincian tagihan", () => {
    it("baris membuka rincian dari data daftar", async () => {
      await click(getButton("INV/2026/10/001", container));

      const isi = teks(dialog());
      expect(isi).toContain("Rincian Tagihan");
      expect(isi).toContain("INV/2026/10/001");
      expect(isi).toContain("Internet 20 Mbps Oktober 2026");
      expect(isi).toContain("Rp 135.000");
      expect(isi).toContain("-Rp 15.000");
      expect(isi).toContain("Lunas");
      expect(isi).toContain("12 Okt 2026");
      expect(isi).toContain("Transfer bank manual");
    });

    it("tagihan yang belum dibayar tidak mengaku punya tanggal bayar", async () => {
      await click(getButton("INV/2026/11/002", container));

      const isi = teks(dialog());
      expect(isi).toContain("Belum Bayar");
      expect(isi).toContain("Rp 150.000");
      expect(isi).not.toContain("Tanggal bayar");
    });

    it("Escape menutup rincian", async () => {
      await click(getButton("INV/2026/10/001", container));

      await pressKey("Escape");

      expect(dialog()).toBeNull();
    });
  });

  it("tombol kembali punya nama", async () => {
    await click(getButton("Kembali", container));

    expect(router.back).toHaveBeenCalled();
  });
});
