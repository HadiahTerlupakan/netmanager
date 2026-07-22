import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PurchaseOrderPdfData } from "@/app/admin/procurement/purchase-orders/po-pdf";

const pdfMocks = vi.hoisted(() => ({
  save: vi.fn(),
  text: vi.fn(),
  autoTable: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("jspdf", () => ({
  default: vi.fn().mockImplementation(function MockJsPdf() {
    return {
      internal: {
        pageSize: {
          getWidth: () => 210,
        },
      },
      setFont: vi.fn(),
      setFontSize: vi.fn(),
      setTextColor: vi.fn(),
      setDrawColor: vi.fn(),
      setLineWidth: vi.fn(),
      line: vi.fn(),
      text: pdfMocks.text,
      splitTextToSize: vi.fn((value: string) => [value]),
      addPage: vi.fn(),
      save: pdfMocks.save,
    };
  }),
}));

vi.mock("jspdf-autotable", () => ({
  default: (...args: unknown[]) => pdfMocks.autoTable(...args),
}));

vi.mock("react-hot-toast", () => ({
  toast: {
    success: pdfMocks.toastSuccess,
    error: pdfMocks.toastError,
  },
}));

import { downloadPurchaseOrderPdf } from "@/app/admin/procurement/purchase-orders/po-pdf";

const basePo: PurchaseOrderPdfData = {
  poNumber: "PO-2026-001",
  status: "ORDERED",
  paymentStatus: "UNPAID",
  totalAmount: 1_000_000,
  ppnAmount: 110_000,
  ppnRate: 11,
  grandTotal: 1_110_000,
  expectedDate: "2026-07-30T00:00:00.000Z",
  notes: "Order kabel fiber",
  fakturPajakNo: null,
  fakturPajakDate: null,
  vendorNpwp: "10.0.0.1-000.000",
  createdAt: "2026-07-22T00:00:00.000Z",
  supplier: { id: "sup-1", name: "PT Supplier Fiber", npwp: null },
  items: [
    {
      quantity: 2,
      unitPrice: 500_000,
      totalPrice: 1_000_000,
      barang: { id: "brg-1", nama: "Kabel Fiber 12C", kode: "BRG-001" },
    },
  ],
  jasaItems: [
    {
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      jasa: {
        id: "jasa-1",
        kode: "JSA-001",
        nama: "Instalasi",
        satuan: "job",
      },
    },
  ],
};

describe("downloadPurchaseOrderPdf", () => {
  beforeEach(() => {
    pdfMocks.save.mockClear();
    pdfMocks.text.mockClear();
    pdfMocks.autoTable.mockClear();
    pdfMocks.toastSuccess.mockClear();
  });

  it("menyimpan file PDF dengan nama PO", () => {
    downloadPurchaseOrderPdf(basePo);

    expect(pdfMocks.save).toHaveBeenCalledWith("PO-PO-2026-001.pdf");
    expect(pdfMocks.toastSuccess).toHaveBeenCalledWith(
      "PDF Purchase Order berhasil diunduh",
    );
  });

  it("merender tabel barang dan jasa", () => {
    downloadPurchaseOrderPdf(basePo);

    expect(pdfMocks.autoTable).toHaveBeenCalledTimes(2);

    const barangTable = pdfMocks.autoTable.mock.calls[0][1] as {
      body: string[][];
    };
    expect(barangTable.body[0]).toEqual(
      expect.arrayContaining(["Kabel Fiber 12C", "2"]),
    );

    const jasaTable = pdfMocks.autoTable.mock.calls[1][1] as {
      body: string[][];
    };
    expect(jasaTable.body[0]).toEqual(
      expect.arrayContaining(["JSA-001", "Instalasi"]),
    );
  });

  it("sanitize karakter khusus di nomor PO", () => {
    downloadPurchaseOrderPdf({
      ...basePo,
      poNumber: "PO/2026:Depok",
    });

    expect(pdfMocks.save).toHaveBeenCalledWith("PO-PO-2026-Depok.pdf");
  });
});
