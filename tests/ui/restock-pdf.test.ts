import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PurchaseRequest } from "@/app/admin/inventory/restock/types";

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
      splitTextToSize: vi.fn((value: string) => value),
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

import { generatePurchaseOrderPdf } from "@/app/admin/inventory/restock/pdf";

const baseRequest: PurchaseRequest = {
  id: "purchase-request-1",
  nomorRequest: "PR/001:Depok",
  status: "APPROVED",
  createdAt: "2026-04-19T00:00:00.000Z",
  approvedAt: "2026-04-20T00:00:00.000Z",
  requester: { name: "Rohadim" },
  approver: { name: "Admin" },
  gudangId: "gudang-a",
  gudang: { id: "gudang-a", nama: "Gudang A" },
  keterangan: "Stok kabel untuk rollout area Depok",
  catatanApproval: "Disetujui untuk prioritas instalasi minggu ini",
  prioritas: "HIGH",
  purchaseOrder: { poNumber: "PO-2026-001", status: "ORDERED" },
  items: [
    {
      id: "item-1",
      barangId: "barang-1",
      jumlah: 2,
      receivedQuantity: 1,
      keterangan: "Untuk ODP baru",
      barang: { kode: "BRG-001", nama: "Kabel Fiber", satuan: "roll" },
    },
  ],
};

function getGeneratedTableOptions() {
  const tableCall = pdfMocks.autoTable.mock.calls.at(-1);

  if (!tableCall) {
    throw new Error("autoTable harus dipanggil");
  }

  return tableCall[1] as { head: string[][]; body: string[][]; startY: number };
}

describe("generatePurchaseOrderPdf", () => {
  beforeEach(() => {
    pdfMocks.save.mockClear();
    pdfMocks.text.mockClear();
    pdfMocks.autoTable.mockClear();
    pdfMocks.toastSuccess.mockClear();
    pdfMocks.toastError.mockClear();
    pdfMocks.autoTable.mockImplementation(
      (doc: { lastAutoTable?: { finalY: number } }) => {
        doc.lastAutoTable = { finalY: 120 };
      },
    );
  });

  it("saves purchase order PDF with a safe filename", () => {
    generatePurchaseOrderPdf(baseRequest);

    expect(pdfMocks.save).toHaveBeenCalledWith("PO-PR-001-Depok.pdf");
    expect(pdfMocks.toastSuccess).toHaveBeenCalledWith(
      "PDF Purchase Order berhasil diunduh",
    );
  });

  it("keeps downloading when auto table does not expose finalY", () => {
    pdfMocks.autoTable.mockImplementation(() => undefined);

    expect(() => generatePurchaseOrderPdf(baseRequest)).not.toThrow();
    expect(pdfMocks.save).toHaveBeenCalledWith("PO-PR-001-Depok.pdf");
  });

  it("uses placeholder item data instead of crashing on incomplete item relation", () => {
    const request = {
      ...baseRequest,
      items: [
        {
          ...baseRequest.items[0],
          barang: undefined,
        },
      ],
    } as unknown as PurchaseRequest;

    expect(() => generatePurchaseOrderPdf(request)).not.toThrow();
    expect(pdfMocks.autoTable).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: [["-", "Barang tidak tersedia", "2 -", "1 -", "Untuk ODP baru"]],
      }),
    );
  });

  it("includes purchase order metadata, notes, and approval context", () => {
    generatePurchaseOrderPdf(baseRequest);

    expect(pdfMocks.text).toHaveBeenCalledWith(
      "Nomor PO:",
      expect.any(Number),
      expect.any(Number),
    );
    expect(pdfMocks.text).toHaveBeenCalledWith(
      "PO-2026-001",
      expect.any(Number),
      expect.any(Number),
    );
    expect(pdfMocks.text).toHaveBeenCalledWith(
      "Prioritas:",
      expect.any(Number),
      expect.any(Number),
    );
    expect(pdfMocks.text).toHaveBeenCalledWith(
      "HIGH",
      expect.any(Number),
      expect.any(Number),
    );
    expect(pdfMocks.text).toHaveBeenCalledWith(
      expect.stringContaining("Stok kabel untuk rollout area Depok"),
      expect.any(Number),
      expect.any(Number),
    );
    expect(pdfMocks.text).toHaveBeenCalledWith(
      expect.stringContaining("Disetujui untuk prioritas instalasi minggu ini"),
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("includes requested quantity, received quantity, unit, and item notes", () => {
    generatePurchaseOrderPdf(baseRequest);

    expect(getGeneratedTableOptions()).toEqual(
      expect.objectContaining({
        head: [["KODE", "NAMA BARANG", "DIMINTA", "DITERIMA", "KETERANGAN"]],
        body: [
          ["BRG-001", "Kabel Fiber", "2 roll", "1 roll", "Untuk ODP baru"],
        ],
      }),
    );
  });
});
