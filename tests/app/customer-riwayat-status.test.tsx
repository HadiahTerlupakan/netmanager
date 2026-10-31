// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/components/customer/CustomerAuthProvider", () => ({
  useCustomerAuth: () => ({ isLoading: false, isAuthenticated: true }),
}));

function buatInvoice(
  invoiceNumber: string,
  status: string,
  totalAmount = 150000,
) {
  return {
    id: invoiceNumber,
    invoiceNumber,
    totalAmount,
    remainingAmount: status === "PAID" ? 0 : totalAmount,
    status,
    items: [{ description: `Tagihan ${invoiceNumber}` }],
    issueDate: "2026-10-10T00:00:00.000Z",
    dueDate: "2026-11-10T00:00:00.000Z",
  };
}

vi.mock("@/lib/hooks/useApi", () => ({
  useApi: () => ({
    data: {
      invoices: [
        buatInvoice("INV-LUNAS", "PAID"),
        buatInvoice("INV-SENT", "SENT"),
        buatInvoice("INV-SEBAGIAN", "PARTIAL_PAID"),
        buatInvoice("INV-BATAL", "CANCELLED"),
        buatInvoice("INV-TELAT", "OVERDUE"),
        buatInvoice("INV-SALDO", "SENT", 0),
      ],
    },
    isLoading: false,
  }),
}));

import CustomerHistoryPage from "@/app/(customer)/riwayat/page";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Status invoice CANCELLED tampil mentah di portal, dan filter "Gagal" hanya
 * mencari VOID yang tidak ada di enum InvoiceStatus, sehingga tagihan yang
 * dibatalkan tidak pernah muncul di filter itu.
 */
describe("halaman riwayat pelanggan: status tagihan", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<CustomerHistoryPage />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const LABEL_STATUS = [
    "Lunas",
    "Belum Bayar",
    "Terlambat",
    "Dibayar Sebagian",
    "Dibatalkan",
    "Draf",
    "Ditutup saldo",
  ];

  function badgeUntuk(invoiceNumber: string) {
    const baris = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes(`#${invoiceNumber}`),
    );
    return Array.from(baris?.querySelectorAll("span") ?? [])
      .map((span) => span.textContent ?? "")
      .find((text) => LABEL_STATUS.includes(text));
  }

  async function klikFilter(label: string) {
    const tombol = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === label,
    )!;
    await act(async () => {
      tombol.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  }

  it("memberi label Indonesia untuk setiap status", () => {
    expect(badgeUntuk("INV-BATAL")).toBe("Dibatalkan");
    expect(badgeUntuk("INV-SEBAGIAN")).toBe("Dibayar Sebagian");
    expect(badgeUntuk("INV-LUNAS")).toBe("Lunas");
    expect(badgeUntuk("INV-TELAT")).toBe("Terlambat");
    expect(container.textContent).not.toContain("CANCELLED");
  });

  // Seluruhnya dipotong saldo kredit dan tinggal diproses.
  it("tagihan Rp 0 yang belum lunas berlabel ditutup saldo, bukan Belum Bayar", () => {
    expect(badgeUntuk("INV-SALDO")).toBe("Ditutup saldo");
  });

  it("filter Dibatalkan menampilkan tagihan CANCELLED", async () => {
    await klikFilter("Dibatalkan");

    expect(container.textContent).toContain("INV-BATAL");
    expect(container.textContent).not.toContain("INV-LUNAS");
    expect(container.textContent).not.toContain("INV-SENT");
  });

  it("filter Menunggu menyertakan tagihan yang baru dibayar sebagian", async () => {
    await klikFilter("Menunggu");

    expect(container.textContent).toContain("INV-SENT");
    expect(container.textContent).toContain("INV-SEBAGIAN");
    expect(container.textContent).not.toContain("INV-BATAL");
  });

  // Navigasi bawah berasal dari layout portal; navigasi buatan halaman ini
  // dulu menimpanya dengan menu yang berbeda dari halaman lain.
  it("tidak memasang navigasi bawah sendiri", () => {
    expect(container.querySelector("nav")).toBeNull();
    expect(container.textContent).not.toContain("Akun");
  });
});
