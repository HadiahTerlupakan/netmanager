import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PurchaseRequest } from "@/app/admin/inventory/restock/types";

const pdfMocks = vi.hoisted(() => ({
  save: vi.fn(),
  text: vi.fn(),
  autoTable: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  addPage: vi.fn(),
  addImage: vi.fn(),
}));

vi.mock("jspdf", () => ({
  default: vi.fn().mockImplementation(function MockJsPdf() {
    return {
      internal: {
        pageSize: {
          getWidth: () => 210,
          getHeight: () => 297,
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
      addPage: pdfMocks.addPage,
      addImage: pdfMocks.addImage,
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

import { generatePurchaseRequestPdf } from "@/app/admin/inventory/restock/pdf";

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

describe("generatePurchaseRequestPdf", () => {
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

  it("saves purchase request PDF with a safe filename", async () => {
    await generatePurchaseRequestPdf(baseRequest);

    expect(pdfMocks.save).toHaveBeenCalledWith("PR-PR-001-Depok.pdf");
    expect(pdfMocks.toastSuccess).toHaveBeenCalledWith(
      "PDF pengajuan sudah diunduh.",
    );
  });

  it("keeps downloading when auto table does not expose finalY", async () => {
    pdfMocks.autoTable.mockImplementation(() => undefined);

    await expect(
      generatePurchaseRequestPdf(baseRequest),
    ).resolves.toBeUndefined();
    expect(pdfMocks.save).toHaveBeenCalledWith("PR-PR-001-Depok.pdf");
  });

  it("uses placeholder item data instead of crashing on incomplete item relation", async () => {
    const request = {
      ...baseRequest,
      items: [
        {
          ...baseRequest.items[0],
          barang: undefined,
        },
      ],
    } as unknown as PurchaseRequest;

    await expect(generatePurchaseRequestPdf(request)).resolves.toBeUndefined();
    expect(pdfMocks.autoTable).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: [
          [
            "-",
            "Barang tidak tersedia",
            "2 -",
            "2 -",
            "2 -\n(2 tanpa catatan belanja)",
            "1 -",
            "-",
            "Untuk ODP baru",
          ],
        ],
      }),
    );
  });

  it("includes purchase request metadata, notes, and approval context", async () => {
    await generatePurchaseRequestPdf(baseRequest);

    expect(pdfMocks.text).toHaveBeenCalledWith(
      "PENGAJUAN BARANG",
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ align: "center" }),
    );
    expect(pdfMocks.text).toHaveBeenCalledWith(
      "Nomor Pengajuan:",
      expect.any(Number),
      expect.any(Number),
    );
    expect(pdfMocks.text).toHaveBeenCalledWith(
      "Status:",
      expect.any(Number),
      expect.any(Number),
    );
    // Barang datang tanpa laporan belanja (data lama): sisanya masih di
    // tahap pembelian.
    expect(pdfMocks.text).toHaveBeenCalledWith(
      "Tahap 4 dari 4 (Verifikasi barang sampai): Datang Sebagian",
      expect.any(Number),
      expect.any(Number),
    );
    expect(pdfMocks.text).not.toHaveBeenCalledWith(
      "Status PO:",
      expect.any(Number),
      expect.any(Number),
    );
    expect(pdfMocks.text).toHaveBeenCalledWith(
      "Kode Pesanan:",
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

  it("includes requested quantity, received quantity, unit, and item notes", async () => {
    await generatePurchaseRequestPdf(baseRequest);

    expect(getGeneratedTableOptions()).toEqual(
      expect.objectContaining({
        head: [
          [
            "KODE",
            "NAMA BARANG",
            "DIMINTA",
            "DISETUJUI",
            "SUDAH DIBELI",
            "SUDAH DATANG",
            "TIDAK DATANG",
            "KETERANGAN",
          ],
        ],
        body: [
          [
            "BRG-001",
            "Kabel Fiber",
            "2 roll",
            "2 roll",
            "2 roll\n(2 tanpa catatan belanja)",
            "1 roll",
            "-",
            "Untuk ODP baru",
          ],
        ],
      }),
    );
  });

  it("shows requested vs approved quantity, substitution and approver notes", async () => {
    await generatePurchaseRequestPdf({
      ...baseRequest,
      items: [
        {
          ...baseRequest.items[0],
          jumlah: 5,
          jumlahDiminta: 8,
          barangIdDiminta: "barang-lama",
          barangDiminta: {
            id: "barang-lama",
            nama: "Kabel Lama",
            kode: "BRG-000",
            satuan: "roll",
          },
          statusApproval: "APPROVED",
          catatanApproval: "Stok gudang masih ada",
        },
      ],
    });

    expect(getGeneratedTableOptions().body).toEqual([
      [
        "BRG-001",
        "Kabel Fiber (pengganti Kabel Lama)",
        "8 roll",
        "5 roll",
        "5 roll\n(5 tanpa catatan belanja)",
        "1 roll",
        "-",
        "Untuk ODP baru\nCatatan atasan: Stok gudang masih ada",
      ],
    ]);
  });

  it("prints what did not come together with the reason", async () => {
    await generatePurchaseRequestPdf({
      ...baseRequest,
      status: "RECEIVED",
      items: [
        {
          ...baseRequest.items[0],
          receivedQuantity: 1,
          cancelledQuantity: 1,
          cancelReason: "Barang habis di toko",
        },
      ],
    });

    expect(getGeneratedTableOptions().body[0][6]).toBe(
      "1 roll\n(Barang habis di toko)",
    );
    expect(pdfMocks.text).toHaveBeenCalledWith(
      "Tahap 4 dari 4 (Verifikasi barang sampai): Selesai, Kurang",
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("still prints rejected lines, marked, when every line was rejected", async () => {
    await generatePurchaseRequestPdf({
      ...baseRequest,
      items: [
        {
          ...baseRequest.items[0],
          receivedQuantity: 0,
          statusApproval: "REJECTED",
          catatanApproval: "Tidak dibutuhkan",
        },
      ],
      jasaItems: [
        {
          id: "jasa-item-1",
          jasaId: "jasa-1",
          jumlah: 1,
          hargaPerUnit: 100,
          totalHarga: 100,
          statusKonfirmasi: "PENDING",
          statusApproval: "REJECTED",
          catatanApproval: "Dikerjakan tim internal",
          jasa: { id: "jasa-1", kode: "JS-1", nama: "Splicing", satuan: "job" },
        },
      ],
    });

    const [barangCall, jasaCall] = pdfMocks.autoTable.mock.calls.map(
      (call) => call[1] as { body: string[][]; head: string[][] },
    );
    expect(barangCall.body[0].slice(3, 6)).toEqual(["Ditolak", "-", "-"]);
    expect(jasaCall.head[0]).toContain("DISETUJUI");
    expect(jasaCall.body[0]).toEqual([
      "JS-1",
      "Splicing",
      "1 job",
      "Ditolak",
      "Ditolak",
      "Catatan atasan: Dikerjakan tim internal",
    ]);
  });
  it("leaves rejected lines out when other lines were approved", async () => {
    await generatePurchaseRequestPdf({
      ...baseRequest,
      items: [
        baseRequest.items[0],
        {
          ...baseRequest.items[0],
          id: "item-rejected",
          barangId: "barang-2",
          receivedQuantity: 0,
          statusApproval: "REJECTED",
          catatanApproval: "Tidak dibutuhkan",
          barang: { kode: "BRG-002", nama: "Patch Cord", satuan: "pcs" },
        },
      ],
      jasaItems: [
        {
          id: "jasa-item-rejected",
          jasaId: "jasa-1",
          jumlah: 1,
          hargaPerUnit: 100,
          totalHarga: 100,
          statusKonfirmasi: "PENDING",
          statusApproval: "REJECTED",
          jasa: { id: "jasa-1", kode: "JS-1", nama: "Splicing", satuan: "job" },
        },
      ],
    });

    expect(pdfMocks.autoTable).toHaveBeenCalledTimes(1);
    const { body } = getGeneratedTableOptions();
    expect(body.map((row) => row[0])).toEqual(["BRG-001"]);
    expect(body.flat()).not.toContain("Ditolak");
    expect(pdfMocks.text).not.toHaveBeenCalledWith(
      "ITEM JASA",
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("keeps approved jasa lines when every barang line was rejected", async () => {
    await generatePurchaseRequestPdf({
      ...baseRequest,
      items: [
        {
          ...baseRequest.items[0],
          receivedQuantity: 0,
          statusApproval: "REJECTED",
        },
      ],
      jasaItems: [
        {
          id: "jasa-item-1",
          jasaId: "jasa-1",
          jumlah: 1,
          hargaPerUnit: 100,
          totalHarga: 100,
          statusKonfirmasi: "PENDING",
          statusApproval: "APPROVED",
          jasa: { id: "jasa-1", kode: "JS-1", nama: "Splicing", satuan: "job" },
        },
      ],
    });

    expect(pdfMocks.autoTable).toHaveBeenCalledTimes(1);
    expect(getGeneratedTableOptions().body.map((row) => row[0])).toEqual([
      "JS-1",
    ]);
  });

  it("prints the requested quantity in the unit of the barang originally asked for", async () => {
    await generatePurchaseRequestPdf({
      ...baseRequest,
      items: [
        {
          ...baseRequest.items[0],
          jumlah: 50,
          jumlahDiminta: 5,
          receivedQuantity: 0,
          barang: { kode: "BRG-9", nama: "Kabel Meteran", satuan: "meter" },
          barangIdDiminta: "barang-lama",
          barangDiminta: {
            id: "barang-lama",
            nama: "Kabel Roll",
            kode: "BRG-000",
            satuan: "roll",
          },
          statusApproval: "APPROVED",
        },
      ],
    });

    expect(getGeneratedTableOptions().body[0].slice(2, 4)).toEqual([
      "5 roll",
      "50 meter",
    ]);
  });

  it("shows no approved quantity while the request is still waiting for a decision", async () => {
    await generatePurchaseRequestPdf({
      ...baseRequest,
      status: "DRAFT",
      items: [{ ...baseRequest.items[0], statusApproval: "PENDING" }],
      jasaItems: [
        {
          id: "jasa-item-1",
          jasaId: "jasa-1",
          jumlah: 1,
          hargaPerUnit: 100,
          totalHarga: 100,
          statusKonfirmasi: "PENDING",
          statusApproval: "PENDING",
          jasa: { id: "jasa-1", kode: "JS-1", nama: "Splicing", satuan: "job" },
        },
      ],
    });

    const [barangCall, jasaCall] = pdfMocks.autoTable.mock.calls.map(
      (call) => call[1] as { body: string[][] },
    );
    expect(barangCall.body[0][3]).toBe("Menunggu");
    expect(jasaCall.body[0][3]).toBe("Menunggu");
  });

  it("marks every line rejected on a request rejected before line decisions existed", async () => {
    await generatePurchaseRequestPdf({
      ...baseRequest,
      status: "REJECTED",
      items: [
        {
          ...baseRequest.items[0],
          receivedQuantity: 0,
          statusApproval: "PENDING",
        },
      ],
      jasaItems: [
        {
          id: "jasa-item-1",
          jasaId: "jasa-1",
          jumlah: 1,
          hargaPerUnit: 100,
          totalHarga: 100,
          statusKonfirmasi: "PENDING",
          statusApproval: "PENDING",
          jasa: { id: "jasa-1", kode: "JS-1", nama: "Splicing", satuan: "job" },
        },
      ],
    });

    const [barangCall, jasaCall] = pdfMocks.autoTable.mock.calls.map(
      (call) => call[1] as { body: string[][] },
    );
    expect(barangCall.body[0].slice(3, 6)).toEqual(["Ditolak", "-", "-"]);
    expect(jasaCall.body[0].slice(3, 5)).toEqual(["Ditolak", "Ditolak"]);
  });
  it("adds the purchase section with buyer names before the signature block", async () => {
    await generatePurchaseRequestPdf({
      ...baseRequest,
      status: "ORDERED",
      purchaseRecords: [
        {
          id: "rec-1",
          storeName: "Toko Sinar Jaya",
          supplierId: null,
          purchasedAt: "2026-04-21T05:00:00.000Z",
          createdAt: "2026-04-21T06:00:00.000Z",
          recordedBy: { name: "Admin" },
          buyerName: "Siti",
          source: "ADMIN",
          hasSignature: false,
          notes: null,
          fotoNota: [],
          items: [
            {
              id: "line-1",
              purchaseOrderItemId: "poi-1",
              barangId: "barang-1",
              nama: "Kabel Fiber",
              satuan: "roll",
              quantity: 1,
              unitPrice: null,
            },
          ],
        },
      ],
    });

    const texts = pdfMocks.text.mock.calls.map(([value]) => String(value));
    const purchaseIndex = texts.indexOf("PEMBELIAN");
    expect(purchaseIndex).toBeGreaterThan(-1);
    expect(texts).toContain("Dibeli oleh: Siti");
    expect(texts).toContain("(dicatat dari aplikasi)");
    expect(texts.indexOf("Dibuat oleh (Pemohon),")).toBeGreaterThan(
      purchaseIndex,
    );
    expect(pdfMocks.save).toHaveBeenCalled();
  });
});
