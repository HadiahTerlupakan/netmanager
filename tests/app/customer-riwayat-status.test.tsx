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

function buatInvoice(invoiceNumber: string, status: string) {
  return {
    id: invoiceNumber,
    invoiceNumber,
    totalAmount: 150000,
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

  function badgeUntuk(invoiceNumber: string) {
    const baris = Array.from(container.querySelectorAll("p"))
      .find((p) => p.textContent === `#${invoiceNumber}`)
      ?.closest("div.justify-between");
    return baris?.querySelector("span")?.textContent;
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
    expect(container.textContent).not.toContain("CANCELLED");
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
});
