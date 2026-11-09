// @vitest-environment jsdom

import type jsPDF from "jspdf";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  drawPurchaseSection,
  fitSignatureSize,
  loadPurchaseSignatures,
  RECORDED_IN_APP_TEXT,
  SIGNATURE_UNAVAILABLE_TEXT,
} from "@/app/admin/inventory/restock/restockPdfPurchases";
import type { PurchaseRecordSummary } from "@/app/admin/inventory/restock/types";

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function makeRecord(
  overrides: Partial<PurchaseRecordSummary> = {},
): PurchaseRecordSummary {
  return {
    id: "rec-1",
    storeName: "Toko Sinar Jaya",
    supplierId: null,
    purchasedAt: "2026-11-08T05:00:00.000Z",
    createdAt: "2026-11-08T06:00:00.000Z",
    recordedBy: { name: "Admin Pembuat Link" },
    buyerName: "Andi",
    source: "PUBLIC_LINK",
    hasSignature: true,
    notes: null,
    fotoNota: [],
    items: [
      {
        id: "line-1",
        purchaseOrderItemId: "poi-1",
        barangId: "barang-1",
        nama: "Kabel Fiber",
        satuan: "roll",
        quantity: 4,
        unitPrice: null,
      },
      {
        id: "line-2",
        purchaseOrderItemId: "poi-2",
        barangId: "barang-2",
        nama: "ONT",
        satuan: "pcs",
        quantity: 2,
        unitPrice: 300000,
      },
    ],
    ...overrides,
  };
}

function makeDoc(pageHeight = 297) {
  const doc = {
    internal: { pageSize: { getHeight: () => pageHeight } },
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    splitTextToSize: vi.fn((value: string, _width?: number) => [value]),
    addPage: vi.fn(),
    addImage: vi.fn(),
    getImageProperties: vi.fn(() => ({ width: 716, height: 400 })),
  };
  return doc;
}

function textsOf(doc: ReturnType<typeof makeDoc>): string[] {
  return doc.text.mock.calls.map(([value]) =>
    Array.isArray(value) ? value.join(" ") : String(value),
  );
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fitSignatureSize", () => {
  it.each([
    ["HP (1,79:1) dibatasi tinggi", 358, 200, 26.85, 15],
    ["layar lebar (4:1) dibatasi lebar", 800, 200, 40, 10],
    ["pas kotak", 80, 30, 40, 15],
  ])("%s", (_label, width, height, expectedWidth, expectedHeight) => {
    const size = fitSignatureSize(width, height);
    expect(size.width).toBeCloseTo(expectedWidth, 1);
    expect(size.height).toBeCloseTo(expectedHeight, 1);
  });

  it("ukuran tidak terbaca → kotak penuh", () => {
    expect(fitSignatureSize(0, 0)).toEqual({ width: 40, height: 15 });
  });
});

describe("loadPurchaseSignatures", () => {
  it("mengambil tanda tangan lewat route ber-auth dan menjadikannya data URL", async () => {
    fetchMock.mockResolvedValue(
      new Response(PNG_BYTES, {
        status: 200,
        headers: { "Content-Type": "image/png" },
      }),
    );

    const signatures = await loadPurchaseSignatures("pr-1", [
      makeRecord(),
      makeRecord({ id: "rec-2", hasSignature: false }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/inventory/restock/requests/pr-1/purchases/rec-1/signature",
    );
    expect(signatures.get("rec-1")).toBe(
      `data:image/png;base64,${Buffer.from(PNG_BYTES).toString("base64")}`,
    );
    expect(signatures.has("rec-2")).toBe(false);
  });

  it("mengisi null bila gagal dimuat, tanpa melempar", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("{}", { status: 404 }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        new Response("<html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
      );

    const signatures = await loadPurchaseSignatures("pr-1", [
      makeRecord({ id: "a" }),
      makeRecord({ id: "b" }),
      makeRecord({ id: "c" }),
    ]);

    expect([...signatures.values()]).toEqual([null, null, null]);
  });

  it("paling banyak memuat 4 sekaligus", async () => {
    let active = 0;
    let peak = 0;
    fetchMock.mockImplementation(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return new Response("{}", { status: 404 });
    });

    await loadPurchaseSignatures(
      "pr-1",
      Array.from({ length: 9 }, (_, index) => makeRecord({ id: `r-${index}` })),
    );

    expect(fetchMock).toHaveBeenCalledTimes(9);
    expect(peak).toBe(4);
  });
});

describe("drawPurchaseSection", () => {
  it("menulis tanggal, toko, barang, nama pembeli, dan gambar tanda tangan", () => {
    const doc = makeDoc();
    const y = drawPurchaseSection(
      doc as unknown as jsPDF,
      120,
      [makeRecord()],
      new Map([["rec-1", "data:image/png;base64,AAA"]]),
    );

    const texts = textsOf(doc);
    expect(texts).toContain("PEMBELIAN");
    expect(texts).toContain("1. 08/11/2026 - Toko Sinar Jaya");
    expect(texts).toContain("Kabel Fiber 4 roll, ONT 2 pcs");
    expect(texts).toContain("Dibeli oleh: Andi (lewat link)");
    expect(texts.join(" ")).not.toContain("Admin Pembuat Link");
    // Kanvas HP 358x200 (×2 dpr): tinggi 15 mm, lebar mengikuti rasio.
    const [, , , , width, height] = doc.addImage.mock.calls[0] as number[];
    expect(doc.addImage.mock.calls[0].slice(0, 3)).toEqual([
      "data:image/png;base64,AAA",
      "PNG",
      20,
    ]);
    expect(height).toBe(15);
    expect(width).toBeCloseTo(26.85, 1);
    expect(y).toBeGreaterThan(120);
  });

  it("menulis teks pengganti bila tanda tangan gagal dimuat atau dicatat dari aplikasi", () => {
    const doc = makeDoc();
    drawPurchaseSection(
      doc as unknown as jsPDF,
      40,
      [
        makeRecord(),
        makeRecord({
          id: "rec-2",
          buyerName: null,
          source: "ADMIN",
          hasSignature: false,
          recordedBy: { name: "Siti" },
        }),
      ],
      new Map([["rec-1", null]]),
    );

    const texts = textsOf(doc);
    expect(texts).toContain(SIGNATURE_UNAVAILABLE_TEXT);
    expect(texts).toContain(RECORDED_IN_APP_TEXT);
    expect(texts).toContain("Dibeli oleh: Siti");
    expect(doc.addImage).not.toHaveBeenCalled();
  });

  it("pindah halaman bila blok belanja tidak muat", () => {
    const doc = makeDoc();
    const y = drawPurchaseSection(
      doc as unknown as jsPDF,
      250,
      [makeRecord(), makeRecord({ id: "rec-2" })],
      new Map(),
    );

    expect(doc.addPage).toHaveBeenCalled();
    expect(y).toBeLessThan(297 - 20);
  });

  it("judul toko dan nama pembeli dibungkus ke lebar teks", () => {
    const doc = makeDoc();
    doc.splitTextToSize.mockImplementation((value: string) =>
      value.length > 40 ? [value.slice(0, 40), value.slice(40)] : [value],
    );
    const record = makeRecord({
      storeName: "T".repeat(120),
      buyerName: "B".repeat(100),
    });

    const y = drawPurchaseSection(
      doc as unknown as jsPDF,
      40,
      [record],
      new Map(),
    );

    const wrappedWidths = doc.splitTextToSize.mock.calls.map(
      ([, width]) => width,
    );
    expect(wrappedWidths).toEqual([170, 170, 170]);
    const drawn = doc.text.mock.calls.map(([value]) => value);
    expect(drawn.filter(Array.isArray)).toHaveLength(3);
    // 2 baris judul + 1 barang + 2 baris pembeli: lebih tinggi dari blok biasa.
    expect(y).toBeGreaterThan(40 + 8 + 5 * 5);
  });

  it("tidak menggambar apa pun tanpa catatan belanja", () => {
    const doc = makeDoc();
    expect(
      drawPurchaseSection(doc as unknown as jsPDF, 100, [], new Map()),
    ).toBe(100);
    expect(doc.text).not.toHaveBeenCalled();
  });
});
